// src/query/cache.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import url from 'url';
import { logger } from '../utils';
import * as consts from './consts';

import fs from 'fs';
import path from 'path';

interface CacheEntry {
    isFetching: Date | null;
    data: any;
    expiry: number;
    dataDate: Date | null;
    dateOnDisk: Date | null;
}

class QueryCache {
    private memoryCache: Record<string, CacheEntry>;

    constructor() {
        this.memoryCache = {};
        if (!fs.existsSync(consts.JSINFO_QUERY_CACHEDIR)) {
            fs.mkdirSync(consts.JSINFO_QUERY_CACHEDIR, { recursive: true });
        }
        logger.info(`QueryCache:: JSINFO_QUERY_CACHE_ENABLED: ${consts.JSINFO_QUERY_CACHE_ENABLED}`);
        logger.info(`QueryCache:: JSINFO_QUERY_DISKCACHE path: ${consts.JSINFO_QUERY_CACHEDIR}`);
        logger.info(`QueryCache:: JSINFO_QUERY_CACHE_POPULTAE_MODE: ${consts.JSINFO_QUERY_CACHE_POPULTAE_MODE}`);
    }

    // 15-26 second cache expiry
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

    getCacheFilePath(key: string): string {
        return path.join(consts.JSINFO_QUERY_CACHEDIR, encodeURIComponent(key));
    }

    // Function to get dataDate from cache
    getDataLastUpdatedDate(key: string): Date | null {
        let cacheEntry = this.memoryCache[key];
        if (!cacheEntry) return null;
        const cacheFilePath = this.getCacheFilePath(key);

        let fileDate: Date | null = null;
        if (fs.existsSync(cacheFilePath)) {
            fileDate = fs.statSync(cacheFilePath).mtime;
        }

        // the bigger one from cacheEntry.dataDate and fileDate
        if (cacheEntry.dataDate && fileDate) {
            return new Date(Math.max(cacheEntry.dataDate.getTime(), fileDate.getTime()));
        } else if (cacheEntry.dataDate) {
            return cacheEntry.dataDate;
        } else if (fileDate) {
            return fileDate;
        } else {
            return null;
        }
    }

    get(key: string): CacheEntry {
        let cacheEntry = this.getOrCreateCacheEntryFromMemoryCache(key);

        const cacheFilePath = this.getCacheFilePath(key);
        if (!fs.existsSync(cacheFilePath)) return cacheEntry;

        const result = this.readDataFromDisk(cacheFilePath);
        if (!result) return cacheEntry;

        if (this.shouldUseEntryFromDisk(cacheEntry, result)) {
            this.updateCacheEntryInMemoryCache(cacheEntry, result, key, cacheFilePath);
        }

        return cacheEntry;
    }

    private shouldUseEntryFromDisk(cacheEntry: CacheEntry, result: any): boolean {
        if (cacheEntry.dateOnDisk === null) {
            return true;
        }

        if (cacheEntry.dateOnDisk < result.stats.mtime) {
            return true;
        }

        if (Object.keys(cacheEntry.data).length === 0) {
            return true;
        }

        return false;
    }

    private updateCacheEntryInMemoryCache(cacheEntry: CacheEntry, result: any, key: string, cacheFilePath: string): void {
        cacheEntry.data = result.data;
        cacheEntry.dateOnDisk = result.stats.mtime;
        cacheEntry.dataDate = new Date();
        logger.info(`QueryCache: date on disk: ${cacheEntry.dateOnDisk} is newer for: "${key}", file modification date: ${result.stats.mtime}. cacheFilePath: ${cacheFilePath}`);
    }

    private getOrCreateCacheEntryFromMemoryCache(key: string): CacheEntry {
        let cacheEntry = this.memoryCache[key];

        if (!cacheEntry) {
            cacheEntry = {
                isFetching: null,
                data: {},
                expiry: this.getNewExpiry(),
                dataDate: null,
                dateOnDisk: null,
            };
            this.memoryCache[key] = cacheEntry;
        }

        if (!cacheEntry.data) {
            cacheEntry.data = {};
        }

        return cacheEntry;
    }

    isFetchInProgress(cacheEntry: CacheEntry): boolean {
        // fetches can only be 3 minutes - after that try again
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        return cacheEntry.isFetching != null && cacheEntry.isFetching > oneMinuteAgo;
    }

    updateData(key: string, newData: any): void {
        if (typeof newData !== 'object' || Object.keys(newData).length === 0) {
            logger.warn(`Invalid data for key: "${key}". Data should be a JSON object with at least one entry. newData: ${newData}`);
            return;
        }

        const cacheEntry = this.get(key);
        cacheEntry.data = newData;
        const cacheFilePath = path.join(consts.JSINFO_QUERY_CACHEDIR, encodeURIComponent(key));
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheEntry.data));
        const stats = fs.statSync(cacheFilePath);
        cacheEntry.dateOnDisk = stats.mtime;
        cacheEntry.dataDate = new Date();
        cacheEntry.expiry = this.getNewExpiry();
    }
}
class RequestCache {
    cache: QueryCache = new QueryCache()

    getCacheKey(request: FastifyRequest): string {
        return url.parse(request.url).pathname || request.url;
    }

    async handleGetDataLastUpdatedDate(request: FastifyRequest, reply: FastifyReply) {
        const dataKeyInCache = this.getCacheKey(request).replace(/\/last-updated/g, "");
        const entry = this.cache.getDataLastUpdatedDate(dataKeyInCache);
        if (entry) {
            reply.send({ 'X-Data-Last-Updated': entry.toISOString() });
        } else {
            reply.send({ 'X-Data-Last-Updated': '' });
        }
    }

    async getOrFetchData(request: FastifyRequest, reply: FastifyReply, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>) {
        const key = this.getCacheKey(request)

        if (key === '') {
            console.error('QueryCache: Error: Key is an empty string');
            throw new Error('Key cannot be an empty string');
        }

        // refetch data?
        if (Object.keys(this.cache.get(key).data).length === 0) {
            logger.info(`QueryCache: No cache entry for ${key}. Fetching data...`);
            if (consts.JSINFO_QUERY_CACHE_POPULTAE_MODE || Object.keys(this.cache.get(key).data).length === 0) {
                await this.tryFetchData(key, request, reply, handler);
            } else {
                this.tryFetchData(key, request, reply, handler);
            }
        }

        // refetch data?
        else if (Date.now() > this.cache.get(key).expiry) {
            logger.info(`QueryCache: Data for ${key} expiered . Fetching data...`);
            if (consts.JSINFO_QUERY_CACHE_POPULTAE_MODE || Object.keys(this.cache.get(key).data).length === 0) {
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
            if (retryCount < 5) { // If it's not the last attempt
                setTimeout(() => {
                    this.tryFetchData(key, request, reply, handler, retryCount + 1);
                }, 1000);
            }
        }
    }

    handleRequestWithCache(
        handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<any> {
        return async (request: FastifyRequest, reply: FastifyReply) => {
            const query = request.query as { [key: string]: unknown };
            const shouldUseCache = consts.JSINFO_QUERY_CACHE_ENABLED && query.cache !== 'bypass';

            if (query.cache) {
                console.log(`Request received from ${request.ip} for ${request.url} with query parameters ${JSON.stringify(query)}`);
            }

            if (shouldUseCache) {
                const data = await this.getOrFetchData(request, reply, handler);
                if (this.isValidData(data)) {
                    return data;
                }
            }

            const handlerData = await handler(request, reply);
            if (this.isValidData(handlerData)) {
                return handlerData;
            }
        };
    }

    private isValidData(data: any): boolean {
        return typeof data === 'object' && data !== null;
    }

}

export default RequestCache;