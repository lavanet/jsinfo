// src/query/classes/RedisCache.ts

import { createClient, RedisClientType } from 'redis';

class RedisCacheClass {
    private client: RedisClientType | null = null;
    private keyPrefix: string;
    private debugLogs: boolean;

    constructor(keyPrefix: string, debugLogs: boolean = false) {
        this.keyPrefix = keyPrefix;
        this.debugLogs = debugLogs;
        this.initializeClient();
    }

    private initializeClient() {
        const redisUrl = process.env.JSINFO_QUERY_REDDIS_CACHE;
        if (!redisUrl) {
            this.log('JSINFO_QUERY_REDDIS_CACHE environment variable is not set.');
            return;
        }

        this.client = createClient({
            url: redisUrl,
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
            this.log('Attempting to reconnect to Redis...');
            this.initializeClient();
            if (this.client) {
                await this.client.connect();
            }
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
            const stringValue = JSON.stringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            this.logError(`Error serializing array for key ${this.keyPrefix + key}`, error);
        }
    }

    private log(message: string) {
        if (!this.debugLogs) return;
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    private logError(message: string, error: any) {
        console.error(`[${new Date().toISOString()}] ${message}`, error);
    }
}

export const RedisCache = new RedisCacheClass("jsinfo");