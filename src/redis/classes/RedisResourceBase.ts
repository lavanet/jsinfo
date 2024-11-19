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
        const argString = Object.entries(args)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(':');
        return `${this.redisKey}:${argString}`;
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
                return data;
            }

            // Detailed logging for empty data
            console.error(`[${this.redisKey}] Fetch returned empty data:`, {
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

            console.error(`[${this.redisKey}] Error fetching resource:`, errorDetails);
            console.error(`[${this.redisKey}] Full error:`, error);

            if (error instanceof Error) {
                console.error(`[${this.redisKey}] Error type:`, error.constructor.name);
                console.error(`[${this.redisKey}] Error properties:`, Object.getOwnPropertyNames(error));
            }
        }
        return null;
    }

    protected async handleIndexerDb(args?: A): Promise<T | null> {
        try {
            const db = await GetJsinfoDbForIndexer();
            return await this.fetch(db, args);
        } catch (error) {
            console.error(`[${this.redisKey}] Indexer DB error:`, {
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
            console.error(`[${this.redisKey}] Query DB error:`, {
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
                console.error(`[${this.redisKey}] Failed to initialize DB instance:`, dbError);
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
            console.error(`[${this.redisKey}] FetchAndPickDb error:`, {
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
}