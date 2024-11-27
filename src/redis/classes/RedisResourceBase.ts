import { RedisCache } from './RedisCache';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { IsIndexerProcess } from '@jsinfo/utils/env';
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
        if (key.includes("providerMonikerSpec")) {
            return cached ? this.deserialize(cached) : null;
        }
        logger.info(`RedisResourceBase:: [${this.redisKey}] Cache ${cached ? 'hit' : 'miss'}:`, {
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

    protected abstract fetchFromDb(args?: A): Promise<T>;

    // Main public method
    async fetch(args?: A): Promise<T | null> {
        const key = this.getKeyWithArgs(args);


        const existingFetch = RedisResourceBase.activeFetches.get(key);

        if (existingFetch) {
            const result = existingFetch as Promise<T | null>;
            return await result;
        }

        const fetchPromise = this.executeFetch(args, key);
        RedisResourceBase.activeFetches.set(key, fetchPromise);

        return await fetchPromise;

    }

    private async executeFetch(args?: A, key?: string): Promise<T | null> {
        try {
            const cached = await this.get(args);

            if (cached) {
                await this.handleCachedData(cached, args, key);
                return cached;
            }

            return await this.fetchAndCacheData(args, key);

        } catch (error) {
            this.handleFetchError(error, args);
            return null;
        } finally {
            RedisResourceBase.activeFetches.delete(key!);
        }
    }

    private async fetchFromDbWithMutex(args?: A, key?: string): Promise<T | null> {
        const existingFetch = RedisResourceBase.activeDbFetches.get(key!);
        if (existingFetch) {
            return existingFetch as Promise<T | null>;
        }

        const fetchPromise = (async () => {
            try {
                return await this.fetchFromDb(args);
            } finally {
                RedisResourceBase.activeDbFetches.delete(key!);
            }
        })();

        RedisResourceBase.activeDbFetches.set(key!, fetchPromise);
        return fetchPromise;
    }

    private async handleCachedData(cached: T, args?: A, key?: string): Promise<void> {
        const ttl = await RedisCache.getTTL(key!);
        if (ttl === undefined) {
            logger.error('Cache TTL check failed', {
                key,
                redisKey: this.redisKey
            });
            return;
        }
        if (ttl >= 0 && ttl < 30) {
            logger.info('Cache entry near expiration, triggering refresh', {
                key,
                ttl,
                redisKey: this.redisKey
            });

            // Background refresh using mutex
            this.fetchFromDbWithMutex(args, key).then(async data => {
                if (data) {
                    await this.set(data, args);
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

    private async fetchAndCacheData(args?: A, key?: string): Promise<T | null> {
        const data = await this.fetchFromDbWithMutex(args, key);
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

    protected generateKey(prefix: string, id: string | number): string {
        return `${prefix}:${id}`;
    }
}