// src/query/classes/RedisCache.ts

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '@jsinfo/utils/logger';
import { GetRedisUrls } from '@jsinfo/utils/env';
import { JSONStringify } from '@jsinfo/utils/fmt';

class RedisCacheClass {
    private clients: RedisClientType[] = [];
    private keyPrefix: string;
    private redisUrls: string[] = [];
    private static activeGets = new Map<string, Promise<string | null>>();
    private static activeSets = new Map<string, Promise<void>>();

    constructor(keyPrefix: string) {
        this.keyPrefix = keyPrefix;
        this.initializeClients();
    }

    private initializeClients() {
        this.redisUrls = GetRedisUrls();
        if (!this.redisUrls.length) {
            logger.error('Redis initialization failed', {
                reason: 'No Redis URLs configured'
            });
            return;
        }
        this.connectAll();
    }

    private async connectAll() {
        console.log(`Attempting to connect to ${this.redisUrls.length} Redis instances...`);

        const maxRetries = 3;
        const retryDelay = 1000; // 1 second between retries

        try {
            this.clients = await Promise.all(this.redisUrls.map(async url => {
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        const client = createClient({
                            url,
                            socket: {
                                connectTimeout: 2000,
                            },
                        }) as RedisClientType;

                        client.on('error', (err) => logger.error('Redis client error', {
                            error: err as Error,
                            url
                        }));

                        await client.connect();
                        console.log(`Connected to Redis at ${url} on attempt ${attempt + 1}`);
                        return client;
                    } catch (err) {
                        logger.error('Redis connection attempt failed', {
                            error: err as Error,
                            url,
                            attempt: attempt + 1,
                            maxRetries
                        });

                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                        }
                    }
                }
                throw new Error(`Failed to connect to Redis at ${url} after ${maxRetries} attempts`);
            }));
        } catch (error) {
            logger.error('Fatal: Redis connection failed', {
                error: error as Error
            });
            process.exit(1);
        }
    }

    private async reconnect() {
        try {
            await this.connectAll();
        } catch (error) {
            logger.error(`Redis reconnect failed`, error);
        }
    }

    async get(key: string): Promise<string | null> {
        const fullKey = this.keyPrefix + key;

        const existingGet = RedisCacheClass.activeGets.get(fullKey);
        if (existingGet) {
            return existingGet;
        }

        const getPromise = (async () => {
            if (!this.clients.length) {
                return null;
            }

            try {
                return await this.clients[0].get(fullKey);
            } catch (error) {
                logger.error('Redis GET operation failed', {
                    error: error as Error,
                    key: fullKey,
                    operation: 'GET',
                    timestamp: new Date().toISOString()
                });
                await this.reconnect();
                return null;
            } finally {
                RedisCacheClass.activeGets.delete(fullKey);
            }
        })();

        RedisCacheClass.activeGets.set(fullKey, getPromise);
        return getPromise;
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const fullKey = this.keyPrefix + key;

        const existingSet = RedisCacheClass.activeSets.get(fullKey);
        if (existingSet) {
            return existingSet;
        }

        const setPromise = (async () => {
            if (!this.clients.length) {
                return;
            }

            try {
                if (ttlSeconds) {
                    await this.clients[0].setEx(fullKey, ttlSeconds, value);
                } else {
                    await this.clients[0].set(fullKey, value);
                }
            } catch (error) {
                logger.error('Redis SET operation failed', {
                    error: error as Error,
                    key: fullKey,
                    operation: 'SET',
                    ttlSeconds,
                    timestamp: new Date().toISOString()
                });
                await this.reconnect();
            } finally {
                RedisCacheClass.activeSets.delete(fullKey);
            }
        })();

        RedisCacheClass.activeSets.set(fullKey, setPromise);
        return setPromise;
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
            logger.error('Redis operation failed', {
                error: error as Error,
                key: this.keyPrefix + key,
                operation: 'GET'
            });
            return null;
        }
    }

    async setArray(key: string, value: any[], ttl: number = 30): Promise<void> {
        try {
            const stringValue = JSONStringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            logger.error('Redis operation failed', {
                error: error as Error,
                key: this.keyPrefix + key,
                operation: 'SET'
            });
        }
    }

    async getDict(key: string): Promise<{ [key: string]: any } | null> {
        const result = await this.get(key);
        if (!result) return null;
        try {
            return JSON.parse(result);
        } catch (error) {
            logger.error('Redis operation failed', {
                error: error as Error,
                key: this.keyPrefix + key,
                operation: 'GET'
            });
            return null;
        }
    }

    async getDictNoKeyPrefix(key: string): Promise<{ [key: string]: any } | null> {
        const result = await this.get(key);
        if (!result) return null;
        try {
            return JSON.parse(result);
        } catch (error) {
            logger.error('Redis operation failed', {
                error: error as Error,
                key: this.keyPrefix + key,
                operation: 'GET'
            });
            return null;
        }
    }

    async setDict(key: string, value: { [key: string]: any }, ttl: number = 30): Promise<void> {
        try {
            const stringValue = JSON.stringify(value);
            await this.set(key, stringValue, ttl);
        } catch (error) {
            logger.error('Redis operation failed', {
                error: error as Error,
                key: this.keyPrefix + key,
                operation: 'SET'
            });
        }
    }

    async getTTL(key: string): Promise<number> {
        const fullKey = this.keyPrefix + key;

        if (!this.clients.length) {
            logger.error('Redis TTL check failed', {
                reason: 'No clients available',
                key: fullKey
            });
            return -2;
        }

        try {
            const ttl = await this.clients[0].ttl(fullKey);
            return ttl;
        } catch (error) {
            logger.error('Redis TTL check failed', {
                error: error as Error,
                key: fullKey
            });
            await this.reconnect();
            return -2;
        }
    }
}

export const RedisCache = new RedisCacheClass("jsinfo-");


