// src/indexer/classes/MemoryCache.ts

import NodeCache from 'node-cache';
import { JSONStringify } from '@jsinfo/utils/fmt';

class MemoryCacheClass {
    private cache: NodeCache;

    constructor(cacheExpirySeconds: number = 30) {
        this.cache = new NodeCache({ stdTTL: cacheExpirySeconds, checkperiod: cacheExpirySeconds * 0.2 });
    }

    async get<T = string>(key: string): Promise<T | null> {
        const value = this.cache.get<string>(key);
        if (!value) {
            return null;
        }

        try {
            return JSON.parse(value) as T;
        } catch {
            return value as unknown as T;
        }
    }

    async set<T = string>(key: string, value: T, ttl: number = 30): Promise<void> {
        const stringValue = typeof value === 'string' ? value : JSONStringify(value);
        this.cache.set(key, stringValue, ttl);
    }

    async getArray<T = any>(key: string): Promise<T[] | null> {
        return this.get<T[]>(key);
    }

    async setArray<T = any>(key: string, value: T[], ttl: number = 30): Promise<void> {
        await this.set(key, value, ttl);
    }

    async getDict<T = { [key: string]: any }>(key: string): Promise<T | null> {
        return this.get<T>(key);
    }

    async setDict<T = { [key: string]: any }>(key: string, value: T, ttl: number = 30): Promise<void> {
        await this.set(key, value, ttl);
    }

    async IsAlive(): Promise<boolean> {
        try {
            const testKey = 'test';
            await this.set(testKey, 'test', 1);
            return true;
        } catch {
            return false;
        }
    }
}

export const MemoryCache = new MemoryCacheClass();
