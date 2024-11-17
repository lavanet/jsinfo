// src/indexer/classes/MemoryCache.ts

import NodeCache from 'node-cache';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';

class MemoryCacheClass {
    private cache: NodeCache;
    private debugLogs: boolean;

    constructor(ttlSeconds: number = 30, debugLogs: boolean = false) {
        this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: ttlSeconds * 0.2 });
        this.debugLogs = debugLogs;
    }

    async get<T = string>(key: string): Promise<T | null> {
        const startTime = Date.now();

        const value = this.cache.get<string>(key);
        if (!value) {
            this.log(`Cache miss for key ${key}.`);
            return null;
        }

        const timeTaken = Date.now() - startTime;
        this.log(`Cache hit for key ${key}. Time taken: ${timeTaken}ms`);

        try {
            return JSON.parse(value) as T;
        } catch {
            // If parsing fails, return the value directly if it's a simple string
            return value as unknown as T;
        }
    }

    async set<T = string>(key: string, value: T, ttl: number = 30): Promise<void> {
        const stringValue = typeof value === 'string' ? value : JSONStringify(value);
        this.cache.set(key, stringValue, ttl);
        this.log(`Set key ${key} with TTL ${ttl}s.`);
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

    private log(message: string) {
        if (!this.debugLogs) return;
        logger.info(`MemoryCache: ${message}`);
    }
}

export const MemoryCache = new MemoryCacheClass();
