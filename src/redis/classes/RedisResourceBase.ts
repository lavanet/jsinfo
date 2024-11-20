import { GetJsinfoDbForIndexer } from '@jsinfo/utils/db';
import { RedisCache } from './RedisCache';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { IsIndexerProcess } from '@jsinfo/utils/env';
import { QueryGetJsinfoDbForQueryInstance, QueryInitJsinfoDbInstance } from '@jsinfo/query/queryDb';

interface BaseArgs {
    [key: string]: any;
}

export abstract class RedisResourceBase<T, A extends BaseArgs = BaseArgs> {
    protected abstract readonly redisKey: string;
    protected readonly ttlSeconds: number = 3600; // Default 1 hour TTL
    private lastUpdateTime: number = 0;

    // Core cache operations with args support
    protected async set(data: T, args?: A): Promise<void> {
        await RedisCache.set(this.getKeyWithArgs(args), this.serialize(data), this.ttlSeconds);
    }

    protected async get(args?: A): Promise<T | null> {
        const cached = await RedisCache.get(this.getKeyWithArgs(args));
        return cached ? this.deserialize(cached) : null;
    }

    // Default JSON serialization
    protected serialize(data: T): string {
        return JSON.stringify(data);
    }

    protected deserialize(data: string): T {
        return JSON.parse(data);
    }

    // Helper for key generation with args
    protected getKeyWithArgs(args?: A): string {
        if (!args) return this.redisKey;
        const stableJson = JSON.stringify(args).toLowerCase();
        return `${this.redisKey}:${stableJson}`;
    }

    protected abstract fetchFromDb(db: PostgresJsDatabase, args?: A): Promise<T>;

    // Main public method
    async fetch(db: PostgresJsDatabase, args?: A): Promise<T | null> {
        try {
            const cached = await this.get(args);
            if (cached) return cached;

            const data = await this.fetchFromDb(db, args);
            if (data) {
                await this.set(data, args);
                const now = Date.now();
                console.log(`RedisResourceBase:: [${this.redisKey}] Fetched and cached data:`, {
                    data: JSON.stringify(data).slice(0, 100) + '...',
                    cacheInfo: {
                        timeSinceLastUpdate: this.lastUpdateTime
                            ? `${((now - this.lastUpdateTime) / 1000).toFixed(1)}s ago`
                            : 'first cache',
                        ttlSeconds: this.ttlSeconds
                    }
                });
                this.lastUpdateTime = now;
                return data;
            }

            // Detailed logging for empty data
            console.error(`RedisResourceBase:: [${this.redisKey}] Fetch returned empty data:`, {
                args,
                ttl: this.ttlSeconds,
                key: this.getKeyWithArgs(args),
                dbConnectionExists: !!db,
                timestamp: new Date().toISOString(),
                isIndexerProcess: IsIndexerProcess()
            });

        } catch (error) {
            // Detailed error logging
            const errorDetails = {
                message: (error as Error).message,
                stack: (error as Error).stack,
                name: (error as Error).name,
                args,
                ttl: this.ttlSeconds,
                key: this.getKeyWithArgs(args),
                resourceKey: this.redisKey,
                timestamp: new Date().toISOString(),
                dbConnectionExists: !!db,
                isIndexerProcess: IsIndexerProcess()
            };

            console.error(`RedisResourceBase:: [${this.redisKey}] Error fetching resource:`, errorDetails);
            console.error(`RedisResourceBase:: [${this.redisKey}] Full error:`, error);

            if (error instanceof Error) {
                console.error(`RedisResourceBase:: [${this.redisKey}] Error type:`, error.constructor.name);
                console.error(`RedisResourceBase:: [${this.redisKey}] Error properties:`, Object.getOwnPropertyNames(error));
            }
        }
        return null;
    }

    protected async handleIndexerDb(args?: A): Promise<T | null> {
        try {
            const db = await GetJsinfoDbForIndexer();
            return await this.fetch(db, args);
        } catch (error) {
            console.error(`RedisResourceBase:: [${this.redisKey}] Indexer DB error:`, {
                message: (error as Error).message,
                name: (error as Error).name,
                stack: (error as Error).stack,
                resourceKey: this.redisKey,
                args,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }

    protected async handleQueryDb(args?: A): Promise<T | null> {
        try {

            let db: PostgresJsDatabase | null = null;
            try {
                db = await QueryGetJsinfoDbForQueryInstance();
            } catch (dbError) {
                await QueryInitJsinfoDbInstance();
            }

            db = await QueryGetJsinfoDbForQueryInstance();
            return await this.fetch(db, args);
        } catch (error) {
            console.error(`RedisResourceBase:: [${this.redisKey}] Query DB error:`, {
                message: (error as Error).message,
                name: (error as Error).name,
                stack: (error as Error).stack,
                resourceKey: this.redisKey,
                args,
                timestamp: new Date().toISOString()
            });
            try {
                await QueryInitJsinfoDbInstance();
            } catch (dbError) {
                console.error(`RedisResourceBase:: [${this.redisKey}] Failed to initialize DB instance:`, dbError);
            }
            return null;
        }
    }

    async fetchAndPickDb(args?: A): Promise<T | null> {
        try {
            return IsIndexerProcess()
                ? await this.handleIndexerDb(args)
                : await this.handleQueryDb(args);
        } catch (error) {
            console.error(`RedisResourceBase:: [${this.redisKey}] FetchAndPickDb error:`, {
                message: (error as Error).message,
                name: (error as Error).name,
                stack: (error as Error).stack,
                resourceKey: this.redisKey,
                args,
                isIndexerProcess: IsIndexerProcess(),
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }

    // Optional utility methods
    protected async refresh(db: PostgresJsDatabase): Promise<void> {
        const data = await this.fetchFromDb(db);
        if (data) await this.set(data);
    }

    protected generateKey(prefix: string, id: string | number): string {
        return `${prefix}:${id}`;
    }

    protected async withDbRetry<R>(
        queryFn: (db: PostgresJsDatabase) => Promise<R>,
        initialDb: PostgresJsDatabase,
        options: {
            checkEmpty?: boolean;
            name?: string;
            retryDelay?: number;
            maxRetries?: number;
        } = {}
    ): Promise<R> {
        const {
            checkEmpty = false,
            name = this.redisKey,
            retryDelay = 500,
            maxRetries = 3
        } = options;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Use initial DB on first attempt, get fresh connection on retries
                let db = attempt === 0 ? initialDb : null;

                if (!db) {
                    if (IsIndexerProcess()) {
                        db = await GetJsinfoDbForIndexer();
                    } else {
                        try {
                            db = await QueryGetJsinfoDbForQueryInstance();
                        } catch (dbError) {
                            await QueryInitJsinfoDbInstance();
                            db = await QueryGetJsinfoDbForQueryInstance();
                        }
                    }
                }

                const result = await queryFn(db);

                if (!checkEmpty || (result && (!Array.isArray(result) || result.length > 0))) {
                    return result;
                }

                if (attempt < maxRetries - 1) {
                    console.warn(`[${name}] Empty result on attempt ${attempt + 1}/${maxRetries}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            } catch (error) {
                const errorDetails = {
                    message: (error as Error).message,
                    stack: (error as Error).stack,
                    name: (error as Error).name,
                    attempt: `${attempt + 1}/${maxRetries}`,
                    resourceKey: this.redisKey,
                    timestamp: new Date().toISOString(),
                    isIndexerProcess: IsIndexerProcess()
                };

                console.error(`[${name}] Query failed:`, errorDetails);

                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    if (!IsIndexerProcess()) {
                        try {
                            await QueryInitJsinfoDbInstance();
                        } catch (initError) {
                            console.error(`[${name}] Failed to reinitialize DB:`, {
                                message: (initError as Error).message,
                                name: (initError as Error).name,
                                attempt: `${attempt + 1}/${maxRetries}`
                            });
                        }
                    }
                }
            }
        }
        throw new Error(`[${name}] Failed to get a valid result after ${maxRetries} attempts`);
    }
}