// src/query/classes/RedisCache.ts

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { logger } from '@jsinfo/utils/logger';
import { GetRedisUrls } from '@jsinfo/utils/env';
import { JSONStringify, MaskPassword } from '@jsinfo/utils/fmt';

class RedisCacheClass {
    private clients: (RedisClientType | null)[] = [];
    private keyPrefix: string;
    private redisUrls: { read: string[]; write: string[] } = { read: [], write: [] };
    private static activeGets = new Map<string, Promise<string | null>>();
    private static activeSets = new Map<string, Promise<void>>();

    constructor(keyPrefix: string) {
        this.keyPrefix = keyPrefix;
        this.initializeClients();
    }

    private initializeClients() {
        this.redisUrls = GetRedisUrls();
        if (!this.redisUrls.write.length) {
            logger.error('Redis initialization failed', {
                reason: 'No write Redis URLs configured'
            });
            return;
        }
        this.connectAll();
    }

    private async connectAll() {
        console.log(`Attempting to connect to ${this.redisUrls.write.length} write Redis instances...`);

        const maxRetries = 100;
        const retryDelay = 1000; // 1 second between retries

        try {
            this.clients = await Promise.all(this.redisUrls.write.map(async url => {
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        console.log(`Connecting to write Redis at ${MaskPassword(url)} on attempt ${attempt + 1}`);
                        const client = createClient({
                            url,
                            socket: {
                                connectTimeout: 500,
                            },
                        }) as RedisClientType;

                        client.on('error', (err) => logger.error('Redis client error', {
                            error: err as Error,
                            url
                        }));

                        await client.connect();
                        console.log(`Connected to write Redis at ${MaskPassword(url)} on attempt ${attempt + 1}`);
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
                logger.warn(`Failed to connect to write Redis at ${MaskPassword(url)} after ${maxRetries} attempts. Proceeding without this client.`);
                return null;
            }));

            this.clients = this.clients.filter(client => client !== null) as RedisClientType[];

            console.log(`Connected to ${this.clients.length} write Redis instances.`);

            console.log(`Attempting to connect to ${this.redisUrls.read.length} read Redis instances...`);
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

    private async connectReadClient(url: string): Promise<RedisClientType> {
        const client = createClient({ url }) as RedisClientType;
        client.on('error', (err) => logger.error('Redis client error', { error: err as Error, url }));
        await client.connect();
        return client;
    }

    async get(key: string): Promise<string | null> {
        const fullKey = this.keyPrefix + key;

        if (!this.clients.length) {
            return null;
        }

        const existingGet = RedisCacheClass.activeGets.get(fullKey);
        if (existingGet) {
            return await existingGet;
        }

        try {
            for (const client of this.clients) {
                if (!client) continue;
                try {
                    return await client.get(fullKey); // Attempt to get from each client
                } catch (error) {
                    logger.error('Redis GET operation failed', {
                        error: error as Error,
                        key: fullKey,
                        operation: 'GET',
                        client: MaskPassword(client.options?.url || ''), // Log the client URL for debugging
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // If all clients failed, attempt to connect to a read Redis URL if available
            if (this.redisUrls.read.length > 0) {
                const readClient = await this.connectReadClient(this.redisUrls.read[0]);
                try {
                    return await readClient.get(fullKey);
                } catch (readError) {
                    logger.error('Redis GET operation failed on read client', {
                        error: readError as Error,
                        key: fullKey,
                        operation: 'GET'
                    });
                } finally {
                    await readClient.quit();
                }
            }

            await this.reconnect();
            return null;
        } finally {
            RedisCacheClass.activeGets.delete(fullKey);
        }
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const fullKey = this.keyPrefix + key;

        const existingSet = RedisCacheClass.activeSets.get(fullKey);
        if (existingSet) {
            return await existingSet;
        }

        const setPromise = (async () => {
            if (!this.clients.length) {
                return;
            }

            try {
                await Promise.all(this.clients.map(async client => {
                    if (!client) return;
                    if (ttlSeconds) {
                        await client.setEx(fullKey, ttlSeconds, value);
                    } else {
                        await client.set(fullKey, value);
                    }
                }));
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
        return await setPromise;
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


