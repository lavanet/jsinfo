import { RedisCache } from './RedisCache';
import { IsIndexerProcess } from '@jsinfo/utils/env';
import { logger } from '@jsinfo/utils/logger';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
interface BaseArgs {
    [key: string]: any;
}

export abstract class RedisResourceBase<T, A extends BaseArgs = BaseArgs> {
    protected abstract readonly redisKey: string;
    protected readonly cacheExpirySeconds: number = 3600; // Default 1 hour TTL
    protected readonly updateBeforeExpirySeconds: number = 60; // Default 1 minute
    private lastUpdateTime: number = 0;

    // Track ongoing fetches per key
    private static activeFetches = new Map<string, Promise<any>>();
    private static activeFetchesFromSource = new Map<string, Promise<any>>();

    // Core cache operations with args support
    protected async set(data: T, args?: A): Promise<void> {
        await RedisCache.set(this.formatRedisKeyWithArgs(args), this.serialize(data), this.cacheExpirySeconds);
    }

    protected async shouldUpdate(args?: A): Promise<boolean> {
        if (!IsMeaningfulText(this.updateBeforeExpirySeconds + "") ||
            this.updateBeforeExpirySeconds >= this.cacheExpirySeconds) {
            return true;
        }
        const key = this.formatRedisKeyWithArgs(args);
        const ttl = await RedisCache.getTTL(key);
        if (ttl === undefined || !IsMeaningfulText(ttl + "")) {
            return true;
        }
        return ttl < this.updateBeforeExpirySeconds;
    }

    protected async get(args?: A): Promise<T | null> {
        const key = this.formatRedisKeyWithArgs(args);
        const cached = await RedisCache.get(key);
        if (key.includes("providerMonikerSpec")) {
            return cached ? this.deserialize(cached) : null;
        }
        logger.info(`RedisResourceBase:: [${this.redisKey}] Cache ${cached ? 'hit' : 'miss'}:`, {
            key,
            args: args ? JSONStringify(args).slice(0, 100) + '...' : 'none',
            dataPreview: cached ? cached.slice(0, 100) + '...' : null,
            timestamp: new Date().toISOString()
        });

        return cached ? this.deserialize(cached) : null;
    }

    // Default JSON serialization
    protected serialize(data: T): string {
        return JSONStringify(data);
    }

    protected deserialize(data: string): T {
        return JSON.parse(data);
    }

    // Helper for key generation with args
    protected formatRedisKeyWithArgs(args?: A): string {
        if (!args) return this.redisKey;
        const stableJson = JSONStringify(args).toLowerCase();
        return `${this.redisKey}:${stableJson}`;
    }

    protected abstract fetchFromSource(args?: A): Promise<T>;

    // Main public method
    async fetch(args?: A): Promise<T | null> {
        const key = this.formatRedisKeyWithArgs(args);

        const existingFetch = RedisResourceBase.activeFetches.get(key);

        if (existingFetch) {
            const result = existingFetch as Promise<T | null>;
            return await result;
        }

        const fetchPromise = this.orchestrateFetch(args, key);
        RedisResourceBase.activeFetches.set(key, fetchPromise);

        return await fetchPromise;
    }

    private async orchestrateFetch(args: A | undefined, key: string): Promise<T | null> {
        try {
            const cached = await this.get(args);

            if (cached) {
                this.recacheDataIfCloseToExpiry(args, key);
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

    private async fetchFromSourceWithMutex(args?: A, key?: string): Promise<T | null> {
        const existingFetch = RedisResourceBase.activeFetchesFromSource.get(key!);
        if (existingFetch) {
            return existingFetch as Promise<T | null>;
        }

        const fetchPromise = (async () => {
            try {
                return await this.fetchFromSource(args);
            } catch (error) {
                const classInfo = {
                    className: this.constructor.name,
                    redisKey: this.redisKey,
                    ttl: this.cacheExpirySeconds,
                    updateBefore: this.updateBeforeExpirySeconds,
                    lastUpdate: this.lastUpdateTime ? new Date(this.lastUpdateTime).toISOString() : 'never',
                    activeFetches: RedisResourceBase.activeFetches.size,
                    activeSourceFetches: RedisResourceBase.activeFetchesFromSource.size,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : 'No stack trace',
                    args: args ? JSON.stringify(args) : 'none'
                };

                logger.error('RedisResourceBase: Error in fetchFromSource:', classInfo);
                throw error;
            } finally {
                RedisResourceBase.activeFetchesFromSource.delete(key!);
            }
        })();

        RedisResourceBase.activeFetchesFromSource.set(key!, fetchPromise);
        return fetchPromise;
    }

    private async recacheDataIfCloseToExpiry(args?: A, key?: string): Promise<void> {
        if (!await this.shouldUpdate(args)) {
            return;
        }
        // Background refresh using mutex
        this.fetchFromSourceWithMutex(args, key).then(async data => {
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

    private async fetchAndCacheData(args?: A, key?: string): Promise<T | null> {
        const data = await this.fetchFromSourceWithMutex(args, key);
        if (data) {
            await this.set(data, args);
            const now = Date.now();
            logger.info('Fetched and cached data', {
                redisKey: this.redisKey,
                key,
                dataPreview: JSONStringify(data).slice(0, 100) + '...',
                timeSinceLastUpdate: this.lastUpdateTime
                    ? `${((now - this.lastUpdateTime) / 1000).toFixed(1)}s ago`
                    : 'first cache',
                cacheExpirySeconds: this.cacheExpirySeconds
            });
            this.lastUpdateTime = now;
            return data;
        }

        logger.error('Fetch returned empty data', {
            redisKey: this.redisKey,
            key,
            args,
            ttl: this.cacheExpirySeconds,
            isIndexerProcess: IsIndexerProcess()
        });
        return null;
    }

    private handleFetchError(error: unknown, args?: A): void {
        logger.error('Error fetching resource', {
            error: {
                message: (error as Error)?.message || 'Unknown error',
                stack: (error as Error)?.stack || 'No stack trace available',
                name: (error as Error)?.name || 'Error',
                code: (error as any)?.code || 'No error code'
            },
            redisKey: this.redisKey,
            key: this.formatRedisKeyWithArgs(args),
            args,
            ttl: this.cacheExpirySeconds,
            isIndexerProcess: IsIndexerProcess()
        });
    }
}