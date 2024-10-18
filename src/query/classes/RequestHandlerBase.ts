// src/query/classes/RequestHandlerBase.ts

import { Pagination, ParsePaginationFromRequest, SerializePagination } from "../utils/queryPagination";
import { FastifyReply, FastifyRequest } from "fastify";
import { GetDataLength, GetDataLengthForPrints } from "../utils/queryUtils";
import { subMonths, isAfter, isBefore, startOfDay, differenceInCalendarDays } from 'date-fns';
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';
import { JSINFO_REQUEST_HANDLER_BASE_DEBUG } from '../queryConsts';
import { RedisCache } from './RedisCache';
import { ParseDateToUtc } from "../utils/queryDateUtils";
import { GetUtcNow, JSONStringify, logger } from "../../utils/utils";

export class RequestHandlerBase<T> {
    protected className: string;
    protected csvFileName: string = "";
    protected data: T[] | null = null;
    protected debug: boolean = JSINFO_REQUEST_HANDLER_BASE_DEBUG;
    protected dataKey: string = "";

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
            instance.dataKey = key;
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
        return `${type.name}-${args ? JSONStringify(args) : "-"}`;
    }

    constructor(className: string) {
        if (!className || className.length < 3) {
            throw new Error("Parameter 'className' must be provided and be longer than 2 characters.");
        }
        this.className = className;
    }

    protected log(message: string) {
        if (!this.debug) return;
        logger.info(`RequestHandler [${this.className}] ${message}`);
    }

    protected getTTL(key: string): number {
        return 30;
    }

    protected getCSVFileName(): string {
        throw new Error("Method 'getCSVFileName' must be implemented.");
    }

    protected getCSVFileNameCached(): string {
        if (this.csvFileName === "") {
            this.csvFileName = this.getCSVFileName();
            if (this.csvFileName === "") {
                throw new Error("Method 'getCSVFileName' must return a valid file name.");
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
        const startTime = Date.now();

        try {
            const pagination = ParsePaginationFromRequest(request);

            const key = `${this.dataKey}|${pagination ? SerializePagination(pagination) : "-"}`;

            const redisVal = await RedisCache.getArray(key);
            if (redisVal) {
                this.logExecutionTime("PaginatedRecordsRequestHandler", startTime, `Cache hit: key: ${key}`);
                return { data: redisVal as T[] };
            }

            const paginatedData = await this.fetchPaginatedRecords(pagination);
            this.logExecutionTime("PaginatedRecordsRequestHandler", startTime, `PaginatedRecordsRequestHandler Cache miss: key: ${key}. paginated items length: ${GetDataLengthForPrints(paginatedData)}`);
            await RedisCache.setArray(key, paginatedData, this.getTTL(key));

            return { data: paginatedData };
        } catch (error) {
            this.handleError("PaginatedRecordsRequestHandler", reply, error);
            return null;
        }
    }

    private logExecutionTime(source: string, startTime: number, message: string) {
        const endTime = Date.now();
        this.log(`${source}:: Execution time: ${endTime - startTime}ms ${message}`);
    }

    private handleError(source: string, reply: FastifyReply, error: unknown) {
        const err = error as Error;
        WriteErrorToFastifyReply(reply, err.message);
        this.log(`${source}:: Error: ${err.message}`);
    }

    public async DateRangeRequestHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | null> {
        const startTime = Date.now();
        try {
            const query = request.query as { [key: string]: string };
            let from: Date;
            let to: Date;

            if ('f' in query && 't' in query) {
                from = ParseDateToUtc(query.f);
                to = ParseDateToUtc(query.t);
            } else {
                // Default to 3 months until now if either 'f' or 't' is not specified
                to = GetUtcNow();
                from = subMonths(to, 3);
            }

            if (isAfter(from, to)) {
                [from, to] = [to, from];
            }

            from = startOfDay(from);
            to = startOfDay(to);

            if (isBefore(from, startOfDay(subMonths(GetUtcNow(), 6)))) {
                throw new Error("From date cannot be more than 6 months in the past.");
            }

            if (isAfter(to, startOfDay(GetUtcNow()))) {
                if (differenceInCalendarDays(to, GetUtcNow()) > 1) {
                    throw new Error("To date cannot be in the future.");
                } else {
                    to = GetUtcNow();
                }
            }

            const key = `${this.dataKey}|${from.toISOString()}|${to.toISOString()}`;
            const redisVal = await RedisCache.getArray(key);
            if (redisVal) {
                this.logExecutionTime("DateRangeRequestHandler", startTime, `(cache hit): ${key}`);
                return { data: redisVal as T[] };
            }

            const filteredData = await this.fetchDateRangeRecords(from, to);
            this.logExecutionTime("DateRangeRequestHandler", startTime, `DateRangeRequestHandler (cache miss): ${key}`);
            RedisCache.setArray(key, filteredData, this.getTTL(key));
            return { data: filteredData };
        } catch (error) {
            this.handleError("DateRangeRequestHandler", reply, error);
            return null;
        }
    }

    public async getTotalItemCountPaginatedHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        const startTime = Date.now();
        const key = `${this.dataKey}|itemCount`;
        try {
            const itemCountRedis = await RedisCache.get(key);
            if (itemCountRedis) {
                this.logExecutionTime("getTotalItemCountPaginatedHandler", startTime, "Fetched item count from cache");
                reply.send({ itemCount: parseInt(itemCountRedis) });
            } else {
                const itemCount = await this.fetchRecordCountFromDb();
                RedisCache.set(key, itemCount.toString(), this.getTTL(key));
                this.logExecutionTime("getTotalItemCountPaginatedHandler", startTime, "Fetched item count from DB and cached");
                reply.send({ itemCount: itemCount });
            }
            return reply;
        } catch (error) {
            this.handleError("getTotalItemCountPaginatedHandler", reply, error);
            return reply;
        }
    }

    public async CSVRequestHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        const startTime = Date.now();
        const cacheKey = `${this.dataKey}|csvData`;
        try {
            const csvRedis = await RedisCache.get(cacheKey);
            if (csvRedis) {
                this.logExecutionTime("CSVRequestHandler", startTime, "CSV data fetched from cache");
                reply.header('Content-Type', 'text/csv');
                reply.header('Content-Disposition', `attachment; filename="${this.getCSVFileNameCached()}"`);
                reply.send(csvRedis);
            } else {
                const data = await this.fetchAllRecords();
                if (GetDataLength(data) == 0) {
                    reply.send("Data is unavailable now");
                    return reply;
                }

                const csv = await this.convertRecordsToCsv(data);
                if (csv == null) {
                    reply.send("Data is not available in CSV format");
                    return reply;
                }

                RedisCache.set(cacheKey, csv);
                this.logExecutionTime("CSVRequestHandler", startTime, "CSV data prepared and cached");
                reply.header('Content-Type', 'text/csv');
                reply.header('Content-Disposition', `attachment; filename="${this.getCSVFileNameCached()}"`);
                reply.send(csv);
            }
            return reply;
        } catch (error) {
            this.handleError("CSVRequestHandler", reply, error);
            return reply;
        }
    }

}
