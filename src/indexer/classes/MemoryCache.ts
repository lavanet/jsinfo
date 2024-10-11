// src/indexer/classes/MemoryCache.ts

import NodeCache from 'node-cache';
import { JSONStringify, logger } from '../../utils/utils';

class MemoryCacheClass {
    private cache: NodeCache;
    private debugLogs: boolean;

    constructor(ttlSeconds: number = 30, debugLogs: boolean = false) {
        this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: ttlSeconds * 0.2 });
        this.debugLogs = debugLogs;
    }

    async get(key: string): Promise<string | null> {
        const startTime = Date.now();

        const value = this.cache.get<string>(key);
        if (!value) {
            this.log(`Cache miss for key ${key}.`);
            return null;
        }

        const timeTaken = Date.now() - startTime;
        this.log(`Cache hit for key ${key}. Time taken: ${timeTaken}ms`);
        return value;
    }

    async set(key: string, value: string, ttl: number = 30): Promise<void> {
        this.cache.set(key, value, ttl);
        this.log(`Set key ${key} with TTL ${ttl}s.`);
    }

    async getArray(key: string): Promise<any[] | null> {
        const result = await this.get(key);
        if (!result) return null;
        try {
            return JSON.parse(result);
        } catch (error) {
            this.logError(`Error parsing JSON for key ${key}`, error);
            return null;
        }
    }

    async setArray(key: string, value: any[], ttl: number = 30): Promise<void> {
        try {
            const stringValue = JSONStringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            this.logError(`Error serializing array for key ${key}`, error);
        }
    }

    async getDict(key: string): Promise<{ [key: string]: any } | null> {
        const result = await this.get(key);
        if (!result) return null;
        try {
            return JSON.parse(result);
        } catch (error) {
            this.logError(`Error parsing JSON for key ${key}`, error);
            return null;
        }
    }

    async setDict(key: string, value: { [key: string]: any }, ttl: number = 30): Promise<void> {
        try {
            const stringValue = JSON.stringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            this.logError(`Error serializing dictionary for key ${key}`, error);
        }
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

    private logError(message: string, error: any) {
        logger.error(`MemoryCache: ${message}`, error);
    }
}

export const MemoryCache = new MemoryCacheClass();
