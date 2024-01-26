// src/queryCache.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import url from 'url';
import { GetEnvVar, logger } from './utils';

import fs from 'fs';
import os from 'os';
import path from 'path';
interface CacheEntry {
    isFetching: Date | null;
    data: any;
    expiry: number;
    dateOnDisk?: Date;
}

var QUERY_CACHE_ENABLED: boolean = true;
var QUERY_CACHE_POPULTAE_MODE = GetEnvVar("JSINFO_QUERY_CACHE_POPULTAE_MODE") === "true";
class QueryCache {
    private cacheDir: string;
    private memoryCache: Record<string, CacheEntry>;

    constructor() {
        this.memoryCache = {};
        if (process.env.JSINFO_QUERY_DISKCACHE && process.env.JSINFO_QUERY_DISKCACHE !== "") {
            this.cacheDir = process.env.JSINFO_QUERY_DISKCACHE;
        } else {
            this.cacheDir = path.join(os.tmpdir(), 'query-cache');
        }
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        logger.info(`QueryCache:: QUERY_CACHE_ENABLED: ${QUERY_CACHE_ENABLED}`);
        logger.info(`QueryCache:: JSINFO_QUERY_DISKCACHE path: ${this.cacheDir}`);
        logger.info(`QueryCache:: JSINFO_QUERY_CACHE_POPULTAE_MODE: ${QUERY_CACHE_POPULTAE_MODE}`);
    }

    getNewExpiry(): number {
        return Date.now() + Math.floor(Math.random() * (11) + 15) * 1000;
    }

    readDataFromDisk(filePath: string): { data: any, stats: fs.Stats } | null {
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                const parsedData = JSON.parse(data);
                const stats = fs.statSync(filePath);
                return { data: parsedData, stats };
            } catch (error: any) {
                logger.warn(`Failed to parse JSON data for file: "${filePath}", error: ${error?.message}`);
            }
        }
        return null;
    }

    get(key: string): CacheEntry {
        // First, try to get the cache entry from the in-memory cache
        let cacheEntry = this.memoryCache[key];
    
        // If the cache entry is not in the in-memory cache, create a new cache entry with empty data
        if (!cacheEntry) {
            cacheEntry = {
                isFetching: null,
                data: {},
                expiry: this.getNewExpiry()
            };
            this.memoryCache[key] = cacheEntry
        }
    
        if (!cacheEntry.data) {
            cacheEntry.data = {};
        }

        const cacheFilePath = path.join(this.cacheDir, encodeURIComponent(key));

        if (!cacheEntry.isFetching && fs.existsSync(cacheFilePath)) {
            const result = this.readDataFromDisk(cacheFilePath);
            if (result && cacheEntry.dateOnDisk && cacheEntry.dateOnDisk < result.stats.mtime) {
                cacheEntry.data = result.data;
                cacheEntry.dateOnDisk = result.stats.mtime;
                logger.info(`QueryCache: date on disk: ${cacheEntry.dateOnDisk} is newer for: "${key}", file modification date: ${result.stats.mtime}. cacheFilePath: ${cacheFilePath}`);
            }
        }

        // If the data in the cache entry is empty, try to load it from the disk
        if (!this.isFetchInProgress(cacheEntry) && Object.keys(cacheEntry.data).length === 0) {
            const result = this.readDataFromDisk(cacheFilePath);
            if (result) {
                logger.info(`QueryCache: Loaded data for key "${key}" from disk. cacheFilePath: ${cacheFilePath}`);
                cacheEntry.data = result.data;
                cacheEntry.dateOnDisk = result.stats.mtime;
            }
        }
    
        return cacheEntry;
    }

    isFetchInProgress(cacheEntry: CacheEntry): boolean {
        // fetches can only be 3 minutes - after that try again
        const thirtySecondsAgo = new Date(Date.now() - 60 * 1000);
        return cacheEntry.isFetching != null && cacheEntry.isFetching > thirtySecondsAgo;
    }

    updateData(key: string, newData: any): void {
        if (typeof newData !== 'object' || Object.keys(newData).length === 0) {
            logger.warn(`Invalid data for key: "${key}". Data should be a JSON object with at least one entry. newData: ${newData}`);
            return;
        }

        const cacheEntry = this.get(key);
        cacheEntry.data = newData;
        const cacheFilePath = path.join(this.cacheDir, encodeURIComponent(key));
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheEntry.data));
        const stats = fs.statSync(cacheFilePath);
        cacheEntry.dateOnDisk = stats.mtime;
        cacheEntry.expiry = this.getNewExpiry();
    }
}
class RequestCache {
    cache: QueryCache = new QueryCache()

    async getOrFetchData(request: FastifyRequest, reply: FastifyReply, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>) {
        const key = url.parse(request.url).pathname || request.url;

        if (key === '') {
            console.error('QueryCache: Error: Key is an empty string');
            throw new Error('Key cannot be an empty string');
        }

        // refetch data?
        if (Object.keys(this.cache.get(key).data).length === 0) {
            logger.info(`QueryCache: No cache entry for ${key}. Fetching data...`);
            if (QUERY_CACHE_POPULTAE_MODE || Object.keys(this.cache.get(key).data).length === 0) { 
                await this.tryFetchData(key, request, reply, handler);
            } else {
                this.tryFetchData(key, request, reply, handler);
            }
        }

        // refetch data?
        else if (Date.now() > this.cache.get(key).expiry) {
            logger.info(`QueryCache: Data for ${key} expiered . Fetching data...`);
            if (QUERY_CACHE_POPULTAE_MODE || Object.keys(this.cache.get(key).data).length === 0) { 
                await this.tryFetchData(key, request, reply, handler);
            } else {
                this.tryFetchData(key, request, reply, handler);
            }
        }

        return this.cache.get(key).data;
    }

    async tryFetchData(key: string, request: FastifyRequest, reply: FastifyReply, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>, retryCount: number = 0) {
        if (this.cache.isFetchInProgress(this.cache.get(key))) return;
        this.cache.get(key).isFetching = new Date();

        try {
            console.time(`QueryCache: handler execution time for ${key}.`);
            const data = await handler(request, reply);
            console.timeEnd(`QueryCache: handler execution time for ${key}.`);
            this.cache.updateData(key, data);
            this.cache.get(key).isFetching = null;
            logger.info(`QueryCache: Data fetched for ${key}.`);
        } catch (error) {
            logger.info(`QueryCache: Error fetching data for ${key} on attempt ${retryCount + 1}.`, error);
            this.cache.get(key).isFetching = null;
            if (retryCount < 2) { // If it's not the last attempt
                setTimeout(() => {
                    this.tryFetchData(key, request, reply, handler, retryCount + 1);
                }, 1000);
            }
        }
    }

    handleRequestWithCache(handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>): (request: FastifyRequest, reply: FastifyReply) => Promise<any> {
        return async (request: FastifyRequest, reply: FastifyReply) => {
            if (QUERY_CACHE_ENABLED) {
                const data = await this.getOrFetchData(request, reply, handler);
                if (typeof data !== 'object' || data === null) {
                    return;
                }
                return data;
            }
            
            const handlerData = await handler(request, reply);
            if (typeof handlerData !== 'object' || handlerData === null) {
                return;
            }
            return handlerData;
        };
    }
}

export default RequestCache;