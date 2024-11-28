import { RedisCache } from './classes/RedisCache';
import { JSONStringify } from '@jsinfo/utils/fmt';

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
        return JSONStringify(data);
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

    protected abstract fetchFromDb(args?: A): Promise<T>;

    // Main public method
    async fetch(args?: A): Promise<T | null> {
        try {
            try {
                const cached = await this.get(args);
                if (cached) return cached;
            } catch (error) {
            }

            const data = await this.fetchFromDb(args);
            if (data) {
                this.set(data, args);
                return data;
            }
        } catch (error) {
            console.error(
                `Error fetching resource: ${this.redisKey}. Details: ${(error as any)?.message || 'Unknown error'}`,
                {
                    error: {
                        message: (error as Error)?.message || 'Unknown error',
                        stack: (error as Error)?.stack || 'No stack trace available',
                        name: (error as Error)?.name || 'Error',
                        code: (error as any)?.code || 'No error code'
                    },
                    args,
                    ttl: this.ttlSeconds,
                    key: this.getKeyWithArgs(args)
                }
            );
        }
        return null;
    }

    // Optional utility methods
    protected async refresh(): Promise<void> {
        const data = await this.fetchFromDb();
        if (data) await this.set(data);
    }

    protected generateKey(prefix: string, id: string | number): string {
        return `${prefix}:${id}`;
    }
}