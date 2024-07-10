// src/query/classes/RequestHandlerBase.ts

import { Pagination, ParsePaginationFromRequest, SerializePagination } from "../utils/queryPagination";
import { FastifyReply, FastifyRequest } from "fastify";
import { GetDataLength, GetDataLengthForPrints } from "../utils/queryUtils";
import { subMonths, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';
import { JSINFO_REQUEST_HANDLER_BASE_DEBUG } from '../queryConsts';

export class RequestHandlerBase<T> {
    protected className: string;
    protected csvFileName: string = "";
    protected data: T[] | null = null;
    protected debug: boolean = JSINFO_REQUEST_HANDLER_BASE_DEBUG;

    private static instances: Map<string, RequestHandlerBase<any>> = new Map();

    protected static GetInstanceBase<C extends new (...args: any[]) => RequestHandlerBase<any>>(this: C, ...args: any[]): InstanceType<C> {
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

    public static GetInstance(...args: any[]): RequestHandlerBase<any> {
        throw new Error("Method 'GetInstance' must be implemented by subclasses.");
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

    protected async fetchAllRecords(): Promise<T[]> {
        throw new Error("Method 'fetchAllRecords' must be implemented.");
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        throw new Error("Method 'fetchRecordCountFromDb' must be implemented.");
    }

    protected async fetchPaginatedRecords(pagination: Pagination | null): Promise<T[]> {
        throw new Error("Method 'fetchPaginatedRecords' must be implemented.");
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<T[]> {
        throw new Error("Method 'fetchDateRangeRecords' must be implemented.");
    }

    protected async convertRecordsToCsv(data: T[]): Promise<string> {
        throw new Error("Method 'convertRecordsToCsv' must be implemented.");
    }

    public async PaginatedRecordsRequestHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | null> {
        const startTime = Date.now(); // Start time tracking
        try {
            const pagination = ParsePaginationFromRequest(request);
            const paginatedData = await this.fetchPaginatedRecords(pagination);
            this.log(`PaginatedRecordsRequestHandler:: Got paginated items. Length of paginatedData: ${GetDataLengthForPrints(paginatedData)}`);
            const endTime = Date.now(); // End time tracking
            this.log(`PaginatedRecordsRequestHandler:: Execution time: ${endTime - startTime}ms for pagination: ${pagination ? SerializePagination(pagination) : "-"}`); // Log execution time
            return { data: paginatedData };
        } catch (error) {
            const endTime = Date.now(); // End time tracking in case of error
            this.log(`PaginatedRecordsRequestHandler:: Execution time: ${endTime - startTime}ms`); // Log execution time even if there's an error
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            this.log(`PaginatedRecordsRequestHandler:: Error occurred: ${err.message}`);
            return null;
        }
    }

    public async DateRangeRequestHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | null> {
        try {
            const query = request.query as { [key: string]: string };
            let from = 'f' in query ? parseISO(query.f) : subMonths(new Date(), 3);
            let to = 't' in query ? parseISO(query.t) : new Date();

            if (isAfter(from, to)) {
                [from, to] = [to, from];
            }

            from = startOfDay(from);
            to = startOfDay(to);

            if (isBefore(from, startOfDay(subMonths(new Date(), 6)))) {
                throw new Error("From date cannot be more than 6 months in the past.");
            }

            if (isAfter(to, startOfDay(new Date()))) {
                throw new Error("To date cannot be in the future.");
            }

            const filteredData = await this.fetchDateRangeRecords(from, to);

            return { data: filteredData };
        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            return null;
        }
    }

    public async getTotalItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const itemCount = await this.fetchRecordCountFromDb();
            reply.send({ itemCount: itemCount });
            return reply;
        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, err.message);
            return reply;
        }
    }

    public async CSVRequestHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchAllRecords();
            if (GetDataLength(data) == 0) {
                reply.send("Data is unavailable now");
                return reply;
            }

            let csv = await this.convertRecordsToCsv(data);
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
