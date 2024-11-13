// src/query/classes/SpecAndConsumerCache.ts

import { sql } from 'drizzle-orm';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';
import { GetUtcNow, IsIndexerProcess, logger, Sleep } from '../../utils/utils'; // Assuming you have a Sleep function
import { GetJsinfoDbForQuery } from '../../utils/dbUtils';
import { JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE } from '../queryConsts';
import { logClassMemory } from './MemoryLogger';

class SpecAndConsumerCacheClass {
    private specCache: Set<string> = new Set();
    private consumerCache: Set<string> = new Set();
    private refreshInterval: number = 2 * 60 * 1000;
    private refreshPromise: Promise<void> | null = null;
    private debugInterval: NodeJS.Timer | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
        if (JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE) {
            this.debugInterval = setInterval(() => this.logMemoryUsage(), 5 * 1000);
            this.logMemoryUsage(); // Initial log
        }
    }

    private async refreshCache(): Promise<void> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this._refreshCache().finally(() => {
            this.refreshPromise = null;
        });

        return this.refreshPromise;
    }

    private async _refreshCache(): Promise<void> {
        const newSpecCache = await RedisCache.getArray('SpecTable') as string[] | null;
        const newConsumerCache = await RedisCache.getArray('ConsumerTable') as string[] | null;

        if (!newSpecCache || newSpecCache.length === 0 || this.specCache.size === 0) {
            this.specCache = new Set(await this.fetchSpecTable());
            RedisCache.setArray('SpecTable', Array.from(this.specCache), this.refreshInterval);
        } else {
            this.specCache = new Set(newSpecCache);
        }

        if (!newConsumerCache || newConsumerCache.length === 0 || this.consumerCache.size === 0) {
            logger.info('Fetching new consumer data from database');
            this.consumerCache = new Set(await this.fetchConsumerTable());
            RedisCache.setArray('ConsumerTable', Array.from(this.consumerCache), this.refreshInterval);
        } else {
            this.consumerCache = new Set(newConsumerCache);
        }

        logger.info('SpecAndConsumerCache refresh completed');
    }

    public IsValidSpec(specId: string): boolean {
        const upperSpecId = specId.toUpperCase();
        if (!this.specCache.has(upperSpecId)) {
            this.refreshCache();
            return false;
        }
        return true;
    }

    public IsValidConsumer(consumer: string): boolean {
        const lowerConsumer = consumer.toLowerCase();
        if (!this.consumerCache.has(lowerConsumer)) {
            this.refreshCache();
            return false;
        }
        return true;
    }

    public GetAllSpecs(): string[] {
        if (this.specCache.size === 0) {
            this.refreshCache();
        }
        return Array.from(this.specCache);
    }

    public GetAllConsumers(): string[] {
        if (this.consumerCache.size === 0) {
            this.refreshCache();
        }
        return Array.from(this.consumerCache);
    }

    private async fetchSpecTable(): Promise<string[]> {
        const db = await GetJsinfoDbForQuery();
        const threeMonthsAgo = GetUtcNow();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // Get specs from provider stakes
        const stakeSpecs = await db
            .select({ specId: JsinfoSchema.providerStakes.specId })
            .from(JsinfoSchema.providerStakes)
            .groupBy(JsinfoSchema.providerStakes.specId);

        // Get specs from provider health
        const healthSpecs = await db
            .select({ specId: JsinfoSchema.providerHealth.spec })
            .from(JsinfoSchema.providerHealth)
            .where(sql`${JsinfoSchema.providerHealth.timestamp} >= ${threeMonthsAgo}`)
            .groupBy(JsinfoSchema.providerHealth.spec);

        // Combine and deduplicate
        const allSpecs = [...stakeSpecs, ...healthSpecs]
            .map(spec => spec.specId!.toUpperCase());

        return Array.from(new Set(allSpecs));
    }

    private async fetchConsumerTable(): Promise<string[]> {
        const db = await GetJsinfoDbForQuery();
        const results = await db
            .select({ consumer: JsinfoSchema.consumerSubscriptionList.consumer })
            .from(JsinfoSchema.consumerSubscriptionList)
            .groupBy(JsinfoSchema.consumerSubscriptionList.consumer);

        return results.map(c => c.consumer.toLowerCase());
    }

    private logMemoryUsage() {
        logClassMemory({
            className: 'SpecAndConsumerCache',
            caches: [this.specCache, this.consumerCache],
            cacheNames: ['spec', 'consumer']
        });
    }

    public cleanup() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
        }
    }
}

// Clean up on process exit
process.on('exit', () => {
    SpecAndConsumerCache.cleanup();
});

export const SpecAndConsumerCache = IsIndexerProcess()
    ? (null as unknown as SpecAndConsumerCacheClass)
    : new SpecAndConsumerCacheClass();
