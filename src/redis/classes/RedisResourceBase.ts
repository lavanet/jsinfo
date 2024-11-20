import { GetJsinfoDbForIndexer } from '@jsinfo/utils/db';
import { RedisCache } from './RedisCache';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { IsIndexerProcess } from '@jsinfo/utils/env';
import { QueryGetJsinfoDbForQueryInstance, QueryInitJsinfoDbInstance } from '@jsinfo/query/queryDb';
import { logger } from '@jsinfo/utils/logger';

interface BaseArgs {
    [key: string]: any;
}

export abstract class RedisResourceBase<T, A extends BaseArgs = BaseArgs> {
    protected abstract readonly redisKey: string;
    protected readonly ttlSeconds: number = 3600; // Default 1 hour TTL
    private lastUpdateTime: number = 0;

    // Track ongoing fetches per key
    private static activeFetches = new Map<string, Promise<any>>();
    private static activeDbFetches = new Map<string, Promise<any>>();

    // Core cache operations with args support
    protected async set(data: T, args?: A): Promise<void> {
        await RedisCache.set(this.getKeyWithArgs(args), this.serialize(data), this.ttlSeconds);
    }

    protected async get(args?: A): Promise<T | null> {
        const key = this.getKeyWithArgs(args);
        const cached = await RedisCache.get(key);
        console.log(`RedisResourceBase:: [${this.redisKey}] Cache ${cached ? 'hit' : 'miss'}:`, {
            key,
            args: args ? JSON.stringify(args).slice(0, 100) + '...' : 'none',
            dataPreview: cached ? cached.slice(0, 100) + '...' : null,
            timestamp: new Date().toISOString()
        });

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
        const key = this.getKeyWithArgs(args);

        // Check for existing fetch
        const existingFetch = RedisResourceBase.activeFetches.get(key);
        if (existingFetch) {
            return existingFetch as Promise<T | null>;
        }

        const fetchPromise = this.executeFetch(db, args, key);
        RedisResourceBase.activeFetches.set(key, fetchPromise);

        return fetchPromise;
    }

    private async executeFetch(db: PostgresJsDatabase, args?: A, key?: string): Promise<T | null> {
        try {
            const cached = await this.get(args);
            if (cached) {
                this.handleCachedData(cached, db, args, key);
                return cached;
            }

            return await this.fetchAndCacheData(db, args, key);
        } catch (error) {
            this.handleFetchError(error, args, db);
            return null;
        } finally {
            RedisResourceBase.activeFetches.delete(key!);
        }
    }

    private async fetchFromDbWithMutex(db: PostgresJsDatabase, args?: A, key?: string): Promise<T | null> {
        const existingFetch = RedisResourceBase.activeDbFetches.get(key!);
        if (existingFetch) {
            logger.info('Waiting for ongoing DB fetch', {
                key,
                redisKey: this.redisKey
            });
            return existingFetch as Promise<T | null>;
        }

        const fetchPromise = (async () => {
            try {
                return await this.fetchFromDb(db, args);
            } finally {
                RedisResourceBase.activeDbFetches.delete(key!);
            }
        })();

        RedisResourceBase.activeDbFetches.set(key!, fetchPromise);
        return fetchPromise;
    }

    private async handleCachedData(cached: T, db: PostgresJsDatabase, args?: A, key?: string): Promise<void> {
        const ttl = await RedisCache.getTTL(key!);
        if (ttl >= 0 && ttl < 30) {
            logger.info('Cache entry near expiration, triggering refresh', {
                key,
                ttl,
                redisKey: this.redisKey
            });

            // Background refresh using mutex
            this.fetchFromDbWithMutex(db, args, key).then(data => {
                if (data) {
                    this.set(data, args);
                    logger.info('Background cache refresh completed', {
                        key,
                        redisKey: this.redisKey
                    });
                }
            }).catch(error => {
                logger.error('Background cache refresh failed', {
                    error: error as Error,
                    key,
                    redisKey: this.redisKey
                });
            });
        }
    }

    private async fetchAndCacheData(db: PostgresJsDatabase, args?: A, key?: string): Promise<T | null> {
        const data = await this.fetchFromDbWithMutex(db, args, key);
        if (data) {
            await this.set(data, args);
            const now = Date.now();
            logger.info('Fetched and cached data', {
                redisKey: this.redisKey,
                key,
                dataPreview: JSON.stringify(data).slice(0, 100) + '...',
                timeSinceLastUpdate: this.lastUpdateTime
                    ? `${((now - this.lastUpdateTime) / 1000).toFixed(1)}s ago`
                    : 'first cache',
                ttlSeconds: this.ttlSeconds
            });
            this.lastUpdateTime = now;
            return data;
        }

        logger.error('Fetch returned empty data', {
            redisKey: this.redisKey,
            key,
            args,
            ttl: this.ttlSeconds,
            dbConnectionExists: !!db,
            isIndexerProcess: IsIndexerProcess()
        });
        return null;
    }

    private handleFetchError(error: unknown, args?: A, db?: PostgresJsDatabase): void {
        logger.error('Error fetching resource', {
            error: error as Error,
            redisKey: this.redisKey,
            key: this.getKeyWithArgs(args),
            args,
            ttl: this.ttlSeconds,
            dbConnectionExists: !!db,
            isIndexerProcess: IsIndexerProcess()
        });
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