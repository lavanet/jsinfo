// src/query/classes/RedisCache.ts

import { createClient, RedisClientType } from 'redis';
import { JSONStringify, logger } from '../../utils/utils';

class RedisCacheClass {
    private client: RedisClientType | null = null;
    private keyPrefix: string;
    private debugLogs: boolean;
    private redisUrl: string | null | undefined = null;

    constructor(keyPrefix: string, debugLogs: boolean = false) {
        this.keyPrefix = keyPrefix;
        this.debugLogs = debugLogs;
        this.initializeClient();
    }

    private initializeClient() {
        this.redisUrl = process.env.JSINFO_QUERY_REDDIS_CACHE;
        if (!this.redisUrl) {
            this.log('JSINFO_QUERY_REDDIS_CACHE environment variable is not set.');
            return;
        }
        this.connect();
    }

    private async connect() {
        if (!this.redisUrl) return;
        this.log('Attempting to reconnect to Redis...');
        this.client = createClient({
            url: this.redisUrl,
            socket: {
                connectTimeout: 5000, // Timeout for connecting to Redis in milliseconds
            },
        });
        this.client.on('error', (err) => this.logError('Redis Client Error', err));
        this.client.connect().catch((err) => {
            this.logError('Failed to connect to Redis', err);
            this.client = null;
        });
    }

    private async reconnect() {
        try {
            this.connect();
        } catch (error) {
            this.logError(`Reddis reconnect failed`, error);
        }
    }

    async get(key: string): Promise<string | null> {
        if (!this.client) {
            this.log('Redis client is not available.');
            return null;
        }

        const fullKey = this.keyPrefix + key;
        const startTime = Date.now();
        try {
            const promise = this.client.get(fullKey);
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
            const result = await Promise.race([promise, timeout]);
            const endTime = Date.now();
            const timeTaken = endTime - startTime;

            if (!result) {
                this.log(`Cache miss for key ${fullKey}. Time taken: ${timeTaken}ms`);
                return null;
            } else {
                this.log(`Cache hit for key ${fullKey}. Time taken: ${timeTaken}ms`);
                return String(result);
            }
        } catch (error) {
            const endTime = Date.now();
            const timeTaken = endTime - startTime;
            this.logError(`Error getting key ${fullKey} from Redis. Time taken: ${timeTaken}ms`, error);
            await this.reconnect();
            return null;
        }
    }

    async set(key: string, value: string, ttl: number = 30): Promise<void> {
        if (!this.client) {
            this.log('Redis client is not available.');
            return;
        }

        try {
            await this.client.set(this.keyPrefix + key, value, {
                EX: ttl,
            });
        } catch (error) {
            this.logError(`Error setting key ${this.keyPrefix + key} in Redis`, error);
            await this.reconnect();
        }
    }

    async getArray(key: string): Promise<any[] | null> {
        const result = await this.get(key);
        if (!result) return null;
        try {
            return JSON.parse(result);
        } catch (error) {
            this.logError(`Error parsing JSON for key ${this.keyPrefix + key}`, error);
            return null;
        }
    }

    async setArray(key: string, value: any[], ttl: number = 30): Promise<void> {
        try {
            const stringValue = JSONStringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            this.logError(`Error serializing array for key ${this.keyPrefix + key}`, error);
        }
    }

    async getDict(key: string): Promise<{ [key: string]: any } | null> {
        const result = await this.get(key);
        if (!result) return null;
        try {
            return JSON.parse(result);
        } catch (error) {
            this.logError(`Error parsing JSON for key ${this.keyPrefix + key}`, error);
            return null;
        }
    }

    async setDict(key: string, value: { [key: string]: any }, ttl: number = 30): Promise<void> {
        try {
            const stringValue = JSON.stringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            this.logError(`Error serializing dictionary for key ${this.keyPrefix + key}`, error);
        }
    }
    private log(message: string) {
        if (!this.debugLogs) return;
        logger.info(`RedisCache: ${message}`);
    }

    private logError(message: string, error: any) {
        logger.error(`RedisCache: ${message}`, error);
    }
}

export const RedisCache = new RedisCacheClass("jsinfo");