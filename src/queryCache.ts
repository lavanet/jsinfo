// src/queryCache.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import url from 'url';

import fs from 'fs';
import os from 'os';
import path from 'path';
interface CacheEntry {
    isFetching: Date | null;
    data: any;
    expiry: number;
    dateOnDisk?: Date;
}

class QueryCache {
    private cacheDir: string;
    private memoryCache: Record<string, CacheEntry>;

    constructor() {
        this.cacheDir = path.join(os.tmpdir(), 'query-cache');
        this.memoryCache = {};
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    getNewExpiry(): number {
        return Date.now() + Math.floor(Math.random() * (11) + 15) * 1000;
    }

    get(key: string): CacheEntry {
        // First, try to get the cache entry from the in-memory cache
        let cacheEntry = this.memoryCache[key];
    
        // If the cache entry is not in the in-memory cache, create a new cache entry with empty data
        if (!cacheEntry) {
            this.memoryCache[key] = cacheEntry = {
                isFetching: null,
                data: {},
                expiry: this.getNewExpiry()
            };
        }
    
        const cacheFilePath = path.join(this.cacheDir, encodeURIComponent(key));

        if (!cacheEntry.isFetching && fs.existsSync(cacheFilePath)) {
            const stats = fs.statSync(cacheFilePath);
            if (cacheEntry.dateOnDisk && cacheEntry.dateOnDisk < stats.mtime) {
                const data = fs.readFileSync(cacheFilePath, 'utf8');
                cacheEntry.data = JSON.parse(data);
                cacheEntry.dateOnDisk = stats.mtime;
            }
            console.log(`QueryCache: date on disk: ${cacheEntry.dateOnDisk} is newer for: "${key}", file modification date: ${stats.mtime}`);
        }
        
        // If the data in the cache entry is empty, try to load it from the disk
        if (!this.isFetchInProgress(cacheEntry) && Object.keys(cacheEntry.data).length === 0) {
            if (fs.existsSync(cacheFilePath)) {
                const data: any = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
                console.log(`QueryCache: Loaded data for key "${key}" from disk`);
                cacheEntry.data = data;
                const stats = fs.statSync(cacheFilePath);
                cacheEntry.dateOnDisk = stats.mtime;
            }
        }
    
        return cacheEntry;
    }

    isFetchInProgress(cacheEntry: CacheEntry): boolean {
        // fetches can only be 30 seconds - after that try again
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
        return cacheEntry.isFetching != null && cacheEntry.isFetching > thirtySecondsAgo;
    }

    updateData(key: string, newData: any): void {
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
            console.log(`QueryCache: No cache entry for ${key}. Fetching data...`);
            await this.tryFetchData(key, request, reply, handler);
        }

        // refetch data?
        if (Date.now() > this.cache.get(key).expiry) {
            console.log(`QueryCache: Data for ${key} expiered . Fetching data...`);
            await this.tryFetchData(key, request, reply, handler);
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
            console.log(`QueryCache: Data fetched for ${key}.`);
        } catch (error) {
            console.log(`QueryCache: Error fetching data for ${key} on attempt ${retryCount + 1}.`);
            console.log(error);
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
            return await this.getOrFetchData(request, reply, handler);
        };
    }
}

export default RequestCache;