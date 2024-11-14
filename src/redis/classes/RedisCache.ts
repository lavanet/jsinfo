// src/query/classes/RedisCache.ts

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { JSONStringify, logger, GetRedisUrls } from '../../utils/utils';

class RedisCacheClass {
    private clients: RedisClientType[] = [];
    private keyPrefix: string;
    private debugLogs: boolean;
    private redisUrls: string[] = [];

    constructor(keyPrefix: string, debugLogs: boolean = false) {
        this.keyPrefix = keyPrefix;
        this.debugLogs = debugLogs;
        this.initializeClients();
    }

    private initializeClients() {
        this.redisUrls = GetRedisUrls();
        if (!this.redisUrls.length) {
            this.log('No Redis URLs configured');
            return;
        }
        this.connectAll();
    }

    private async connectAll() {
        this.log(`Attempting to connect to ${this.redisUrls.length} Redis instances...`);
        this.clients = await Promise.all(this.redisUrls.map(async url => {
            const client = createClient({
                url,
                socket: {
                    connectTimeout: 5000,
                },
            }) as RedisClientType;
            client.on('error', (err) => this.logError(`Redis Client Error for ${url}`, err));
            await client.connect().catch((err) => {
                this.logError(`Failed to connect to Redis at ${url}`, err);
            });
            return client;
        }));
    }

    private async reconnect() {
        try {
            await this.connectAll();
        } catch (error) {
            this.logError(`Redis reconnect failed`, error);
        }
    }

    async get(key: string): Promise<string | null> {
        if (!this.clients.length) {
            this.log('No Redis clients available.');
            return null;
        }

        const fullKey = this.keyPrefix + key;
        const startTime = Date.now();
        try {
            const promise = this.clients[0].get(fullKey);
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
            const result = await Promise.race([promise, timeout]);
            const timeTaken = Date.now() - startTime;

            if (!result) {
                this.log(`Cache miss for key ${fullKey}. Time taken: ${timeTaken}ms`);
                return null;
            }
            this.log(`Cache hit for key ${fullKey}. Time taken: ${timeTaken}ms`);
            return String(result);
        } catch (error) {
            const timeTaken = Date.now() - startTime;
            this.logError(`Error getting key ${fullKey} from Redis. Time taken: ${timeTaken}ms`, error);
            await this.reconnect();
            return null;
        }
    }

    async set(key: string, value: string, ttl: number = 30): Promise<void> {
        if (!this.clients.length) {
            this.log('No Redis clients available.');
            return;
        }

        const fullKey = this.keyPrefix + key;
        try {
            await Promise.all(this.clients.map(client =>
                client.set(fullKey, value, {
                    EX: ttl,
                })
            ));
        } catch (error) {
            this.logError(`Error setting key ${fullKey} in Redis`, error);
            await this.reconnect();
        }
    }

    async IsAlive(): Promise<boolean> {
        if (!this.clients.length) {
            return false;
        }

        try {
            const testKey = this.keyPrefix + "test";
            await Promise.all(this.clients.map(client =>
                client.set(testKey, "test", { EX: 1 })
            ));
            return true;
        } catch (error) {
            return false;
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

    async getDictNoKeyPrefix(key: string): Promise<{ [key: string]: any } | null> {
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

export const RedisCache = new RedisCacheClass("jsinfo-");


