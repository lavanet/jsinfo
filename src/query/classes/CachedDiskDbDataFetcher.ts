// src/query/classes/CachedDiskDbDataFetcher.ts

import fs from 'fs';
import { Pagination, ParsePaginationFromRequest } from "../utils/queryPagination";
import { FastifyReply, FastifyRequest } from "fastify";
import { GetDataLength, GetDataLengthForPrints, GetTypeAsString } from "../utils/queryUtils";
import { subMonths, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import {
    JSINFO_QUERY_CACHEDIR,
    JSINFO_QUERY_CACHE_ENABLED,
    JSINFO_QUERY_HANDLER_CACHE_FETCH_LOCK_TIME_SECONDS,
    JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS,
    JSINGO_CACHED_DB_DATA_FETCHER_DEBUG
} from "../queryConsts";
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';

if (!GetDataLengthForPrints) {
    throw new Error("GetDataLengthForPrints is undefined or null");
}

export class CachedDiskDbDataFetcher<T> {
    protected cacheDir: string = JSINFO_QUERY_CACHEDIR;
    protected cacheFilePath: string = "";
    protected csvFileName: string = "";
    protected cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS;
    protected fetchLockExpiryInSeconds: number = JSINFO_QUERY_HANDLER_CACHE_FETCH_LOCK_TIME_SECONDS;
    protected data: any = null;
    protected isDataEmpty: boolean = false;
    protected isDataFetched: boolean = false;
    protected dataFetchStartTime: Date | null = null;
    protected className: string;
    protected debug: boolean = JSINGO_CACHED_DB_DATA_FETCHER_DEBUG;
    protected sinceData: string | number | null = null;
    protected sinceDataDate: Date | null = null;

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

    private getSinceFilePath(): string {
        return this.getCacheFilePath() + ".since";
    }

    public setSince(data: string | number): void {
        if (typeof data !== 'string' && typeof data !== 'number') {
            throw new Error(`Invalid type for argument 'data'. Expected string or number but received ${typeof data}.`);
        }

        const sinceFilePath = this.getSinceFilePath();
        this.sinceData = data;
        this.saveSinceDataToDisk();
    }

    private saveSinceDataToDisk(): void {
        if (this.sinceData) {
            fs.writeFileSync(this.getSinceFilePath(), JSON.stringify({ data: this.sinceData }));
        }
    }

    public getSince(): string | number | null {
        const sinceFilePath = this.getSinceFilePath();
        if (!fs.existsSync(sinceFilePath)) {
            this.saveSinceDataToDisk();
            return this.sinceData;
        }

        const stats = fs.statSync(sinceFilePath);
        const fileModifiedDate = stats.mtime;

        if (!this.sinceData || (this.sinceDataDate && fileModifiedDate > this.sinceDataDate)) {
            const rawData = fs.readFileSync(sinceFilePath, 'utf-8');
            try {
                const parsedData = JSON.parse(rawData);
                if (parsedData.data) {
                    this.sinceData = isNaN(Number(parsedData.data)) ? parsedData.data : Number(parsedData.data);
                    this.sinceDataDate = fileModifiedDate;
                } else {
                    this.saveSinceDataToDisk();
                }
            } catch (error) {
                this.saveSinceDataToDisk();
            }
        }

        return this.sinceData;

    }

    protected isSinceDBFetchEnabled(): boolean {
        return false
    }

    protected sinceUniqueField(): string | null {
        if (!this.isSinceDBFetchEnabled()) {
            throw new Error("Method 'sinceUniqueField' must be implemented if 'isSinceDBFetchEnabled' returns true.");
        }
        return null
    }

    protected getCacheFilePathImpl(): string {
        throw new Error("Method 'getCacheFilePathImpl' must be implemented.");
    }

    protected getCacheFilePath(): string {
        if (this.cacheFilePath === "") {
            this.cacheFilePath = this.getCacheFilePathImpl();
            if (this.cacheFilePath === "") {
                throw new Error("Method 'getCacheFilePathImpl' must return a valid file path.");
            }
        }
        return this.cacheFilePath;
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

    protected async fetchDataFromDb(): Promise<T[]> {
        throw new Error("Method 'fetchDataFromDb' must be implemented.");
    }

    protected async fetchDataFromDbSinceFlow(since: number | string): Promise<T[]> {
        throw new Error("Method 'fetchDataFromDbSinceFlow' must be implemented.");
    }

    protected async getPaginatedItemsImpl(data: T[], pagination: Pagination | null): Promise<T[] | null> {
        throw new Error("Method 'getPaginatedItemsImpl' must be implemented.");
    }

    protected async getItemsByFromToImpl(data: T[], fromDate: Date, toDate: Date): Promise<T[] | null> {
        throw new Error("Method 'getItemsByFromToImpl' must be implemented.");
    }

    public async getCSVImpl(data: T[]): Promise<string> {
        throw new Error("Method 'getCSVImpl' must be implemented.");
    }

    private getLockFilePath(): string {
        return this.getCacheFilePath() + ".lock";
    }

    private deleteFile(filePath: string): void {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    private lockExists(): boolean {
        return fs.existsSync(this.getLockFilePath());
    }

    private lockIsFresh(): boolean {
        const lockFilePath = this.getLockFilePath();
        const stats = fs.statSync(lockFilePath);
        const ageInSeconds = (Date.now() - stats.birthtime.getTime()) / 1000;
        return ageInSeconds <= this.fetchLockExpiryInSeconds;
    }

    private createLock(): void {
        fs.writeFileSync(this.getLockFilePath(), '');
    }

    private deleteLock(): void {
        this.deleteFile(this.getLockFilePath());
    }

    protected async runFetchAndCacheThreadIfNeeded() {
        this.log('runFetchAndCacheThreadIfNeeded:: called');

        if (this.dataFetchStartTime) {
            const ageInSeconds = (Date.now() - this.dataFetchStartTime.getTime()) / 1000;
            if (ageInSeconds >= this.fetchLockExpiryInSeconds) {
                this.dataFetchStartTime = null;
            } else {
                this.log('runFetchAndCacheThreadIfNeeded:: Data is already fetching, returning early');
                return;
            }
        }

        if (this.lockExists() && this.lockIsFresh()) {
            this.log(`runFetchAndCacheThreadIfNeeded:: isDataFetched: ${this.isDataFetched}, didDataExpire: ${this.didDataExpire()}, Data not fetched yet or data expired, fetching data`);
            return null;
        }

        this.log('runFetchAndCacheThreadIfNeeded:: Creating lock');
        this.createLock();
        this.dataFetchStartTime = new Date();

        if (this.isDataFetched && !this.didDataExpire()) {
            this.log('runFetchAndCacheThreadIfNeeded:: Data already fetched and not expired, no need to fetch');
            this.dataFetchStartTime = null;
            return;
        }

        this.log(`runFetchAndCacheThreadIfNeeded:: isDataFetched: ${this.isDataFetched}, didDataExpire: ${this.didDataExpire()}, Data not fetched yet or data expired, fetching data`);
        setTimeout(() => {
            this.fetchAndCacheDataBg();
            this.log('runFetchAndCacheThreadIfNeeded:: fetchAndCacheDataBg - done - Deleting lock');
            this.dataFetchStartTime = null;
            this.deleteLock();
        }, 0);
    }

    private getSinceDebugString(): string {
        return this.isSinceDBFetchEnabled() ? String(this.getSince()) : "-disabled-";
    }

    private async fetchDataBg() {
        this.log('fetchDataBg:: Called');

        let retries = 5;
        let intervalId: any = null;

        while (retries > 0) {
            try {
                this.log(`fetchDataBg:: Fetching data from DB, since: ${this.getSinceDebugString()}`);

                // Start pinging every second
                let pingCount = 0;
                const startTime = Date.now();
                intervalId = setInterval(() => {
                    pingCount++;
                    this.log(`fetchDataBg:: fetchDataFromDb Ping ${pingCount}, since: ${this.getSinceDebugString()}`);
                }, 1000);

                let data: T[] | null = null;
                const dbSinceFlow = this.isSinceDBFetchEnabled() && this.getSince() != null && this.data != null && GetDataLength(this.data) != 0;

                if (dbSinceFlow) {
                    data = await this.fetchDataFromDbSinceFlow(this.getSince()!);
                    this.log('fetchDataBg:: Fetched data using fetchDataFromDbSinceFlow');
                } else {
                    data = await this.fetchDataFromDb();
                    this.log('fetchDataBg:: Fetched data using fetchDataFromDb');
                }

                // Stop pinging when data is fetched
                clearInterval(intervalId);
                const endTime = Date.now();
                const elapsedTime = (endTime - startTime) / 1000; // Convert to seconds
                this.log(`fetchDataBg:: fetchDataFromDb completed. Total pings: ${pingCount}, Total time: ${elapsedTime} seconds, since: ${this.getSinceDebugString()}`);

                return data;

            } catch (e) {
                if (intervalId) {
                    clearInterval(intervalId);
                }

                this.log(`fetchDataBg:: Error occurred: ${e}, retrying, since: ${this.getSinceDebugString()}`);
                console.error("fetchDataBg:: CachedDiskDbDataFetcher Error:", this.getCacheFilePath(), e);
                retries--;
            }
        }

        return null;
    }

    protected setDataIsEmpty(): void {
        this.log("setDataIsEmpty:: Called")
        fs.writeFileSync(this.getCacheFilePath(), JSON.stringify({ "empty": true }));
        this.isDataFetched = true;
        this.data = { "empty": true };
        this.isDataEmpty = true;
    }

    private async fetchAndCacheDataBg() {
        this.log('fetchAndCacheDataBg:: Called');

        // data is about to be refetched - check if it's possible to get non empty data
        this.isDataEmpty = false;

        let data = await this.fetchDataBg();

        // data is still empty, return
        if (this.isDataEmpty) return;

        let empty_data_retries = 3;

        while (empty_data_retries > 0) {
            if (data == null) {
                this.log(`fetchAndCacheDataBg:: Data is null, retrying, since: ${this.getSinceDebugString()}`);
                empty_data_retries--;
                data = await this.fetchDataBg();
                continue;
            } else if (GetDataLength(data) === 0) {
                const is_since_enabled_and_already_fetched_data = this.isSinceDBFetchEnabled() && this.data != null && GetDataLength(this.data) != 0;
                if (is_since_enabled_and_already_fetched_data) {
                    this.log(`fetchAndCacheDataBg:: since enabled, we have data and we did not fetch new data, since: ${this.getSinceDebugString()}`);
                    return;
                } else {
                    this.log(`fetchAndCacheDataBg:: Data is empty, retrying, since: ${this.getSinceDebugString()}, empty_data_retries: ${empty_data_retries}`);
                    empty_data_retries--;
                    if (empty_data_retries == 0) {
                        this.log(`fetchAndCacheDataBg:: Data is empty, no more retries, since: ${this.getSinceDebugString()}, empty_data_retries: ${empty_data_retries}`);
                        this.setDataIsEmpty();
                    }
                    data = await this.fetchDataBg();
                    continue;
                }
            }

            this.log(`fetchAndCacheDataBg:: Writing data to cache file: ${this.getCacheFilePath()}, since: ${this.getSinceDebugString()}`);

            this.isDataFetched = true;

            const oldLength = this.data ? GetDataLength(this.data) : "-";
            let oldLength1 = "";
            const fetchedLength = data ? GetDataLength(data) : "-";

            const dbSinceFlow = this.isSinceDBFetchEnabled() && this.getSince() != null && this.data != null && GetDataLength(this.data) != 0;
            if (dbSinceFlow) {
                const uniqueField = this.sinceUniqueField();
                if (uniqueField != null) {

                    if (!Array.isArray(this.data)) {
                        this.log(`Error: this.data is not an array, it's a ${GetTypeAsString(this.data)}`);
                        throw new TypeError('this.data is not an array');
                    }

                    if (!Array.isArray(data)) {
                        this.log(`Error: data is not an array, it's a ${GetTypeAsString(data)}`);
                        throw new TypeError('data is not an array');
                    }

                    oldLength1 = this.data ? GetDataLength(this.data) + "" : "-";

                    // Create a set of unique field values from `data`
                    const newDataUniqueValues = new Set(data.map(item => item[uniqueField]));

                    // Filter `this.data` to remove items that match `newDataUniqueValues`
                    this.data = this.data.filter(item => !newDataUniqueValues.has(item[uniqueField]));
                }

                const new_data = data.concat(this.data);
                this.data = new_data;
            } else {
                this.data = data;
            }

            fs.writeFileSync(this.getCacheFilePath(), JSON.stringify(this.data));

            this.log(`fetchAndCacheDataBg:: Data fetched and written to cache.dbSinceFlow:${dbSinceFlow}.isDataFetched:${this.isDataFetched}.prevlen:${oldLength},${oldLength1}.fetchedlen:${fetchedLength}.newlen:${GetDataLength(this.data)}.since:${this.getSinceDebugString()}`);

            break;
        }
    }

    protected didDataExpire(): boolean {
        this.log(`didDataExpire:: called. cache file path: ${this.getCacheFilePath()}`);

        if (!JSINFO_QUERY_CACHE_ENABLED) {
            this.log('didDataExpire:: Cache is disabled');
            return true;
        }

        if (!fs.existsSync(this.getCacheFilePath())) {
            this.log('didDataExpire:: Cache file does not exist');
            return true;
        }

        this.log('didDataExpire:: Cache is enabled and cache file exists');
        const stats = fs.statSync(this.getCacheFilePath());
        const ageInSeconds = (Date.now() - stats.mtime.getTime()) / 1000;
        this.log(`didDataExpire:: Cache file age in seconds: ${ageInSeconds}`);

        if (ageInSeconds > this.cacheAgeLimit) {
            this.log('didDataExpire:: Cache file is old, data expired');
            return true;
        }

        this.log('didDataExpire:: Cache file is fresh, data did not expire');
        return false;
    }

    private cleanState() {
        this.deleteFile(this.getCacheFilePath());
        this.deleteFile(this.getSinceFilePath());
        this.deleteFile(this.getLockFilePath());
        this.sinceData = null;
        this.sinceDataDate = null;
        this.isDataEmpty = false;
        this.isDataFetched = false;
        this.dataFetchStartTime = null;
    }

    private readCacheFileData(): void {
        try {
            const rawData = fs.readFileSync(this.getCacheFilePath(), 'utf-8');
            this.data = JSON.parse(rawData);
            this.isDataEmpty = this.data && this.data.empty === true;
        } catch (error) {
            console.error(`Error parsing JSON from ${this.getCacheFilePath()}: ${error} - cleaning state`);
            this.cleanState()
        }
    }

    protected async fetchDataFromCache(): Promise<T[] | null> {
        this.log('fetchDataFromCache:: calling runFetchAndCacheThreadIfNeeded');
        this.runFetchAndCacheThreadIfNeeded();

        if (this.data != null) {
            this.log(`fetchDataFromCache:: Data fetched from mem, returning data. Type of data: ${GetTypeAsString(this.data)}, Length of data: ${GetDataLengthForPrints(this.data)}`);
            return this.data;
        }

        this.log(`fetchDataFromCache:: Cache file path: ${this.getCacheFilePath()}`);

        if (fs.existsSync(this.getCacheFilePath())) {
            this.log('fetchDataFromCache:: Cache file exists, reading data');
            this.readCacheFileData();
        }

        if (this.data == null || GetDataLength(this.data) === 0) {
            this.log('fetchDataFromCache:: Data is null or empty, checking if data is locked');
            let dataIsLocked = this.lockExists() && this.lockIsFresh();
            if (dataIsLocked) {
                this.log('fetchDataFromCache:: Data is locked, not deleting cache file');
            } else {
                this.cleanState();
            }
            this.log('fetchDataFromCache:: Resetting data to null');
            this.data = null;
        }

        this.log(`fetchDataFromCache:: Data fetched from disk, returning data. Type of data: ${GetTypeAsString(this.data)}, Length of data: ${GetDataLengthForPrints(this.data)}`);
        return this.data;
    }

    public async getPaginatedItemsCachedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: T[] } | {} | null> {
        try {
            const data = await this.fetchDataFromCache();

            if (this.isDataEmpty) {
                return { data: [] }
            }

            this.log(`getPaginatedItemsCachedHandler:: Fetched data from cache. Type of data: ${GetTypeAsString(data)}, Length of data: ${GetDataLengthForPrints(data)}`);

            if (data == null) return {};

            let pagination = ParsePaginationFromRequest(request)
            let paginatedData = await this.getPaginatedItemsImpl(data, pagination);
            this.log(`getPaginatedItemsCachedHandler:: Got paginated items. Type of paginatedData: ${GetTypeAsString(paginatedData)}, Length of paginatedData: ${GetDataLengthForPrints(paginatedData)}`);

            if (paginatedData == null) return {};
            return { data: paginatedData };

        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, String(err.message));
            this.log(`getPaginatedItemsCachedHandler:: Error occurred: ${err.message}`);
            return null
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

            let fromDate = 'f' in query && typeof query.f === 'string'
                ? parseISO(query.f)
                : subMonths(new Date(), 3);

            let toDate = 't' in query && typeof query.t === 'string'
                ? parseISO(query.t)
                : new Date();

            if (isAfter(fromDate, toDate)) {
                [fromDate, toDate] = [toDate, fromDate];
            }

            const fromDateStartOfDay = startOfDay(fromDate);
            const sixMonthsAgoStartOfDay = startOfDay(subMonths(new Date(), 6));
            const sixMonthsMinusOneDay = subDays(sixMonthsAgoStartOfDay, 1);

            if (isBefore(fromDateStartOfDay, sixMonthsMinusOneDay)) {
                throw new Error(`From date (${fromDateStartOfDay.toISOString()}) cannot be more than 6 months in the past (${sixMonthsAgoStartOfDay.toISOString()}).`);
            }

            const currentDateStartOfDay = startOfDay(new Date);
            const toDateStartOfDay = startOfDay(toDate);

            if (isAfter(toDateStartOfDay, currentDateStartOfDay)) {
                throw new Error(`To date (${toDateStartOfDay.toISOString()}) cannot be in the future (${currentDateStartOfDay.toISOString()}).`);
            }

            const filteredData: T[] | null = await this.getItemsByFromToImpl(data, fromDate, toDate);

            if (filteredData == null) {
                reply.send({});
                return null;
            }

            if (GetDataLength(filteredData) == 0) {
                return { data: [] };
            }

            return { data: filteredData };

        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, String(err.message));
            return null
        }
    }

    public async getTotalItemCountRawHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchDataFromCache();
            if (this.isDataEmpty) {
                reply.send({ itemCount: 0 });
                return reply;
            }
            if (data == null) {
                reply.send({});
                return reply;
            }
            reply.send({ itemCount: data.length });
            return reply;

        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, String(err.message));
            return reply;
        }
    }

    public async getCSVRawHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
        try {
            const data = await this.fetchDataFromCache();
            if (this.isDataEmpty) {
                reply.send("Data is empty");
                return reply;
            }
            if (data == null) {
                reply.send("Data is unavailable now");
                return reply;
            }

            let csv = await this.getCSVImpl(data);
            if (csv == null) {
                reply.send("Data is not available is csv");
                return reply;
            }

            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename=${this.getCSVFileName()}`);
            reply.send(csv);
            return reply;

        } catch (error) {
            const err = error as Error;
            WriteErrorToFastifyReply(reply, String(err.message));
            return reply;
        }
    }
}

