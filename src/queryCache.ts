// src/queryCache.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import url from 'url';

interface CacheEntry {
    isFetching: boolean;
    data: any;
    expiry: number;
}

class RequestCache {
    cache: Record<string, CacheEntry> = {};

    async getOrFetchData(request: FastifyRequest, reply: FastifyReply, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>) {
        const key = url.parse(request.url).pathname || request.url;

        if (key === '') {
            console.error('QueryCache: Error: Key is an empty string');
            throw new Error('Key cannot be an empty string');
        }

        if (!this.cache[key]) {
            console.log(`QueryCache: No cache entry for ${key}. Fetching data...`);
            this.tryFetchData(key, request, reply, handler);

        } else if (this.cache[key].isFetching) {
            console.log(`QueryCache: Data for ${key} is currently being fetched...`);

        } else if (Date.now() > this.cache[key].expiry) {
            console.log(`QueryCache: Cache entry for ${key} has expired. Refreshing...`);
            this.tryFetchData(key, request, reply, handler);
        }

        return this.cache[key]?.data || {};
    }

    async tryFetchData(key: string, request: FastifyRequest, reply: FastifyReply, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>, retryCount: number = 0) {
        // generates a random number between 25 and 35
        // blocks are 30 seconds . from gil: if the latest block is 30 seconds old, refresh the cache
        // adding a 5 second margin to not make all the quries at the same time

        if (this.cache[key]) {
            // If the key exists, only update the properties
            this.cache[key].isFetching = true;
            this.cache[key].expiry = Date.now() + Math.floor(Math.random() * (25 - 15 + 1) + 15) * 1000; // Random number between 15 and 25 seconds
        } else {
            // If the key doesn't exist, create a new entry
            this.cache[key] = {
                isFetching: true,
                data: {},
                expiry: Date.now() + Math.floor(Math.random() * (25 - 15 + 1) + 15) * 1000, // Random number between 15 and 25 seconds
            };
        }

        try {
            console.time(`QueryCache: handler execution time for ${key}`);
            const data = await handler(request, reply);
            console.timeEnd(`QueryCache: handler execution time for ${key}`);
            this.cache[key].data = data;
            this.cache[key].isFetching = false;
            console.log(`QueryCache: Data fetched for ${key}`);
        } catch (error) {
            console.log(`QueryCache: Error fetching data for ${key} on attempt ${retryCount + 1}`);
            this.cache[key].isFetching = false;
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