// src/query/classes/RequestHandlerBase.ts

import fs from 'fs';
import { Pagination, ParsePaginationFromRequest } from "../utils/queryPagination";
import { FastifyReply, FastifyRequest } from "fastify";
import { GetDataLength, GetDataLengthForPrints, GetTypeAsString } from "../utils/queryUtils";
import { subMonths, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';

export class RequestHandlerBase<T> {
    protected csvFileName: string = "";
    protected data: T[] | null = null;
    protected isDataEmpty: boolean = false;
    protected isDataFetched: boolean = false;
    protected dataFetchStartTime: Date | null = null;
    protected className: string;
    protected debug: boolean = false;

    private static instances: Map<string, RequestHandlerBase<any>> = new Map();

    protected static GetInstance<C extends new (...args: any[]) => RequestHandlerBase<any>>(this: C, ...args: any[]): InstanceType<C> {
        args.forEach((arg, index) => {
            if (!(arg instanceof Date) && typeof arg !== 'number' && typeof arg !== 'string' && arg !== null && arg !== undefined) {
                throw new Error(`Invalid type for argument at index ${index}. Expected Date, number, string, null, or undefined but received ${typeof arg}.`);
            }
        });

        const key = RequestHandlerBase.generateKeyFromTypeAndArgs(this, args);
        let instance = RequestHandlerBase.instances.get(key);
        if (!instance) {
            instance = new this(...args);
            RequestHandlerBase.instances.set(key, instance);
        }
        return instance as InstanceType<C>;
    }

    private static generateKeyFromTypeAndArgs(type: Function, args: any[]): string {
        if (!type.name || type.name === 'RequestHandlerBase') {
            throw new Error(`Type name must not be empty or equal to "RequestHandlerBase". className: ${type.name}`);
        }
        return JSON.stringify({ type: type.name, args });
    }

    constructor(className: string) {
        if (!className || className.length < 3) {
            throw new Error("Parameter 'className' must be provided and be longer than 2 characters.");
        }
        this.className = className;
    }

    protected log(message: string) {
        if (this.debug) {
            console.log(`[${new Date().toISOString()}] [${this.className}] ${message}`);
        }
    }

    protected getCacheFilePathImpl(): string {
        throw new Error("Method 'getCacheFilePathImpl' must be implemented.");
    }

    protected getCSVFileNameImpl(): string {
        throw new Error("Method 'getCSVFileNameImpl' must be implemented.");
    }

    protected getCSVFileName(): string {
        if (this.csvFileName === "") {
            this.csvFileName = this.getCSVFileNameImpl();
            if (this.csvFileName === "") {
                throw new Error("Method 'getCSVFileNameImpl' must return a valid file name.");
            }
        }
        return this.csvFileName;
    }

    protected async fetchAllDataFromDb(): Promise<T[]> {
        throw new Error("Method 'fetchAllDataFromDb' must be implemented.");
    }

    protected async fetchDataWithPaginationFromDb(data: T[], pagination: Pagination | null): Promise<T[] | null> {
        throw new Error("Method 'fetchDataWithPaginationFromDb' must be implemented.");
    }

    protected async getItemsByFromToImpl(data: T[], fromDate: Date, toDate: Date): Promise<T[] | null> {
        throw new Error("Method 'getItemsByFromToImpl' must be implemented.");
    }

    public async getCSVImpl(data: T[]): Promise<string> {
        throw new Error("Method 'getCSVImpl' must be implemented.");
    }

    private async fetchAndCacheDataBg() {
        this.log('fetchAndCacheDataBg:: Called');
        this.isDataEmpty = false;
        let data = await this.fetchAllDataFromDb();

        if (this.isDataEmpty) return;

        let empty_data_retries = 3;

        while (empty_data_retries > 0) {
            if (data == null || GetDataLength(data) === 0) {
                this.log(`fetchAndCacheDataBg:: Data is null or empty, retrying (${empty_data_retries} retries left)`);
                empty_data_retries--;
                data = await this.fetchAllDataFromDb();
                continue;
            }

            this.isDataFetched = true;
            fs.writeFileSync(this.getCacheFilePathImpl(), JSON.stringify(data));
            this.log(`fetchAndCacheDataBg:: Data fetched and written to cache. Data length: ${GetDataLength(data)}`);
            break;
        }
    }

    protected async fetchDataFromCache(): Promise<T[] | null> {
        this.log('fetchDataFromCache:: calling fetchAndCacheDataBg');
        await this.fetchAndCacheDataBg();

        if (this.data != null) {
            this.log(`fetchDataFromCache:: Data fetched from mem, returning data. Length of data: ${GetDataLengthForPrints(this.data)}`);
            return this.data;
        }

        this.log(`fetchDataFromCache:: Cache file path: ${this.getCacheFilePathImpl()}`);

        if (fs.existsSync(this.getCacheFilePathImpl())) {
            this.log('fetchDataFromCache:: Cache file exists, reading data');
            this.data = JSON.parse(fs.readFileSync(this.getCacheFilePathImpl(), { encoding: 'utf8' }));
        }

        if (this.data == null || GetDataLength(this.data) === 0) {
            this.log('fetchDataFromCache:: Data is null or empty, resetting data to null');
            this.data = null;
        }

        this.log(`fetchDataFromCache:: Data fetched from disk, returning data. Length of data: ${GetDataLengthForPrints(this.data)}`);
        return this.data;
    }

    public async getPaginatedItemsCachedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | {} | null> {
        try {
            const data = await this.fetchAllDataFromDb();
            if (this.isDataEmpty) {
                return { data: [] };
            }

            this.log(`getPaginatedItemsCachedHandler:: Fetched data from cache. Length of data: ${GetDataLengthForPrints(data)}`);

            if (data == null) {
                return {};
            }

            const pagination = ParsePaginationFromRequest(request);
            const paginatedData = await this.fetchDataWithPaginationFromDb(data, pagination);
            this.log(`getPaginatedItemsCachedHandler:: Got paginated items. Length of paginatedData: ${GetDataLengthForPrints(paginatedData)}`);

            if (paginatedData == null) {
                return {};
            }
            return { data: paginatedData };
        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            this.log(`getPaginatedItemsCachedHandler:: Error occurred: ${err.message}`);
            return null;
        }
    }

    public async getItemsByFromToChartsHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | null> {
        try {
            const data = await this.fetchDataFromCache();
            if (this.isDataEmpty) {
                return { data: [] };
            }

            if (data == null) {
                reply.send({});
                return null;
            }

            const query = request.query as { [key: string]: string };
            let fromDate = 'f' in query ? parseISO(query.f) : subMonths(new Date(), 3);
            let toDate = 't' in query ? parseISO(query.t) : new Date();

            if (isAfter(fromDate, toDate)) {
                [fromDate, toDate] = [toDate, fromDate];
            }

            fromDate = startOfDay(fromDate);
            toDate = startOfDay(toDate);

            if (isBefore(fromDate, startOfDay(subMonths(new Date(), 6)))) {
                throw new Error("From date cannot be more than 6 months in the past.");
            }

            if (isAfter(toDate, startOfDay(new Date()))) {
                throw new Error("To date cannot be in the future.");
            }

            const filteredData = await this.getItemsByFromToImpl(data, fromDate, toDate);
            if (filteredData == null || GetDataLength(filteredData) === 0) {
                return { data: [] };
            }

            return { data: filteredData };
        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            return null;
        }
    }

    public async getTotalItemCountRawHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchDataFromCache();
            if (this.isDataEmpty || data == null) {
                reply.send({ itemCount: 0 });
                return reply;
            }
            reply.send({ itemCount: GetDataLength(data) });
            return reply;
        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            return reply;
        }
    }

    public async getCSVRawHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchDataFromCache();
            if (this.isDataEmpty || data == null) {
                reply.send("Data is unavailable now");
                return reply;
            }

            let csv = await this.getCSVImpl(data);
            if (csv == null) {
                reply.send("Data is not available in CSV format");
                return reply;
            }

            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename="${this.getCSVFileName()}"`);
            reply.send(csv);
            return reply;
        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            return reply;
        }
    }

}
