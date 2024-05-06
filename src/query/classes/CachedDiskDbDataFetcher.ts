// src/query/classes/CachedDiskDbDataFetcher.ts

import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS } from "../queryConsts";
import fs from 'fs';
import { Pagination, ParsePaginationFromRequest } from "../utils/queryPagination";
import { FastifyReply, FastifyRequest } from "fastify";
import { GetDataLengthForPrints } from "../utils/queryUtils";

if (!GetDataLengthForPrints) {
    throw new Error("GetDataLengthForPrints is undefined or null");
}

export class CachedDiskDbDataFetcher<T> {
    protected cacheDir: string = JSINFO_QUERY_CACHEDIR;
    protected cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds
    protected data: any = null;
    protected data_fetched: boolean = false;
    protected data_fetching: boolean = false;
    protected className: string;
    protected debug: boolean = true;

    private static instances: Map<string, CachedDiskDbDataFetcher<any>> = new Map();

    protected static GetInstanceBase<C extends new (...args: any[]) => CachedDiskDbDataFetcher<any>>(this: C, ...args: any[]): InstanceType<C> {
        args.forEach((arg, index) => {
            if (!(arg instanceof Date) && typeof arg !== 'number' && typeof arg !== 'string' && arg !== null && arg !== undefined) {
                throw new Error(`Invalid type for argument at index ${index}. Expected Date, number, string, null, or undefined but received ${typeof arg}.`);
            }
        });

        const key = CachedDiskDbDataFetcher.generateKeyFromTypeAndArgs(this, args);
        let instance = CachedDiskDbDataFetcher.instances.get(key);
        if (!instance) {
            instance = new this(...args);
            CachedDiskDbDataFetcher.instances.set(key, instance);
        }
        return instance as InstanceType<C>;
    }

    private static generateKeyFromTypeAndArgs(type: Function, args: any[]): string {
        if (!type.name || type.name === 'CachedDiskDbDataFetcher') {
            throw new Error(`Type name must not be empty or equal to "CachedDiskDbDataFetcher". className: ${type.name}`);
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

    protected getCacheFilePath(): string {
        this.log('getCacheFilePath called but must be implemented.');
        throw new Error("Method 'getCacheFilePath' must be implemented.");
    }

    protected getCSVFileName(): string {
        throw new Error("Method 'getCSVFileName' must be implemented.");
    }

    protected async fetchDataFromDb(): Promise<T[]> {
        this.log('fetchDataFromDb called but must be implemented.');
        throw new Error("Method 'fetchDataFromDb' must be implemented.");
    }

    protected async getPaginatedItemsImpl(data: T[], pagination: Pagination | null): Promise<T[] | null> {
        this.log('getPaginatedItemsImpl called but must be implemented.');
        throw new Error("Method 'getPaginatedItemsImpl' must be implemented.");
    }

    public async getCSVImpl(data: T[]): Promise<string> {
        this.log('getCSVImpl called but must be implemented.');
        throw new Error("Method 'getCSVImpl' must be implemented.");
    }

    private lockExists(): boolean {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        return fs.existsSync(lockFilePath);
    }

    private lockIsFresh(): boolean {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        const stats = fs.statSync(lockFilePath);
        const ageInSeconds = (Date.now() - stats.birthtime.getTime()) / 1000;
        return ageInSeconds <= 60;
    }

    private createLock(): void {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        fs.writeFileSync(lockFilePath, '');
    }

    private deleteLock(): void {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }
    }

    protected async runFetchAndCacheThreadIfNeeded() {
        this.log('runFetchAndCacheThreadIfNeeded:: called');
        if (this.data_fetching) {
            this.log('runFetchAndCacheThreadIfNeeded:: Data is already fetching, returning early');
            return;
        }
        if (this.lockExists() && this.lockIsFresh()) {
            this.log(`runFetchAndCacheThreadIfNeeded:: data_fetched: ${this.data_fetched}, didDataExpire: ${this.didDataExpire()}, Data not fetched yet or data expired, fetching data`);
            return null;
        }
        this.log('runFetchAndCacheThreadIfNeeded:: Creating lock');
        this.createLock();
        this.data_fetching = true;

        if (this.data_fetched && !this.didDataExpire()) {
            this.log('runFetchAndCacheThreadIfNeeded:: Data already fetched and not expired, no need to fetch');
            return;
        }

        this.log(`runFetchAndCacheThreadIfNeeded:: data_fetched: ${this.data_fetched}, didDataExpire: ${this.didDataExpire()}, Data not fetched yet or data expired, fetching data`);
        setImmediate(() => this.fetchAndCacheData());
    }

    private async fetchAndCacheData() {
        try {
            this.log('fetchAndCacheData:: Fetching data from DB');
            const data = await this.fetchDataFromDb();
            const cacheFilePath = this.getCacheFilePath();
            this.log(`fetchAndCacheData:: Writing data to cache file: ${cacheFilePath}`);
            fs.writeFileSync(cacheFilePath, JSON.stringify(data));
            this.data_fetched = true;
            this.data = data;
            this.log(`fetchAndCacheData:: data_fetched set to: ${this.data_fetched}, data length: ${this.data.length}, Data fetched and written to cache`);
        } catch (e) {
            this.log(`fetchAndCacheData:: Error occurred: ${e}`);
            console.error("fetchAndCacheData:: CachedDiskDbDataFetcher Error:", this.getCacheFilePath(), e);
        }
        this.data_fetching = false;
        this.log('fetchAndCacheData:: Deleting lock');
        this.deleteLock();
    }

    protected didDataExpire(): boolean {
        this.log('didDataExpire:: called');
        const cacheFilePath = this.getCacheFilePath();
        this.log(`didDataExpire:: Cache file path: ${cacheFilePath}`);

        if (!JSINFO_QUERY_CACHE_ENABLED) {
            this.log('didDataExpire:: Cache is disabled');
            return false;
        }

        if (!fs.existsSync(cacheFilePath)) {
            this.log('didDataExpire:: Cache file does not exist');
            return false;
        }

        this.log('didDataExpire:: Cache is enabled and cache file exists');
        const stats = fs.statSync(cacheFilePath);
        const ageInSeconds = (Date.now() - stats.mtime.getTime()) / 1000;
        this.log(`didDataExpire:: Cache file age in seconds: ${ageInSeconds}`);

        if (ageInSeconds > this.cacheAgeLimit) {
            this.log('didDataExpire:: Cache file is old, data expired');
            return false;
        }

        this.log('didDataExpire:: Cache file is fresh, data did not expire');
        return true;
    }

    protected async fetchDataFromCache(): Promise<T[] | null> {
        this.log('fetchDataFromCache:: Running background fetch');
        this.runFetchAndCacheThreadIfNeeded();

        if (this.data != null) {
            this.log(`fetchDataFromCache:: Data fetched from mem, returning data. Type of data: ${typeof this.data}, Length of data: ${GetDataLengthForPrints(this.data)}`);
            return this.data;
        }

        const cacheFilePath = this.getCacheFilePath();
        this.log(`fetchDataFromCache:: Cache file path: ${cacheFilePath}`);

        if (fs.existsSync(cacheFilePath)) {
            this.log('fetchDataFromCache:: Cache file exists, reading data');
            const rawData = fs.readFileSync(cacheFilePath, 'utf-8');
            this.data = JSON.parse(rawData);
        }

        this.log(`fetchDataFromCache:: Data fetched from disk, returning data. Type of data: ${typeof this.data}, Length of data: ${GetDataLengthForPrints(this.data)}`);
        return this.data;
    }

    public async getPaginatedItemsCachedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | {} | null> {
        try {
            const data = await this.fetchDataFromCache();
            this.log(`getPaginatedItemsCachedHandler:: Fetched data from cache. Type of data: ${typeof data}, Length of data: ${GetDataLengthForPrints(data)}`);
            if (data == null) return {};
            let pagination = ParsePaginationFromRequest(request)
            let paginatedData = await this.getPaginatedItemsImpl(data, pagination);
            this.log(`getPaginatedItemsCachedHandler:: Got paginated items. Type of paginatedData: ${typeof paginatedData}, Length of paginatedData: ${GetDataLengthForPrints(paginatedData)}`);
            if (paginatedData == null) return {};
            return { data: paginatedData };
        } catch (error) {
            const err = error as Error;
            reply.code(400).send({ error: String(err.message) });
            this.log(`getPaginatedItemsCachedHandler:: Error occurred: ${err.message}`);
            return null
        }
    }

    public async getTotalItemCountRawHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchDataFromCache();
            if (data == null) {
                reply.send({});
                return reply;
            }
            reply.send({ itemCount: data.length });
            return reply;
        } catch (error) {
            const err = error as Error;
            reply.code(400).send({ error: String(err.message) });
            return reply;
        }
    }

    public async getCSVRawHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchDataFromCache();
            if (data == null) {
                reply.send({});
                return reply;
            }
            let csv = await this.getCSVImpl(data);
            if (csv == null) {
                reply.send({});
                return reply;
            }

            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename=${this.getCSVFileName()}`);
            reply.send(csv);
            return reply;
        } catch (error) {
            const err = error as Error;
            reply.code(400).send({ error: String(err.message) });
            return reply;
        }
    }
}

