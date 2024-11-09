// src/query/classes/SpecAndConsumerCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import { sql } from 'drizzle-orm';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';
import { logger } from '../../utils/utils';
import { JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE } from '../queryConsts';
import { logClassMemory } from './MemoryLogger';

class SpecAndConsumerCacheClass {
    private specCache: string[] = [];
    private consumerCache: string[] = [];
    private refreshInterval = 2 * 60 * 1000;
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<void> | null = null;
    private debugInterval: NodeJS.Timer | null = null;

    public constructor() {
        // "const error = Errors.postgres(parseError(x))"
        // Comment this when migrations are stuck (i think this is solved in the timescale branch)
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);

        // Setup memory debugging if enabled
        if (JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE) {
            this.debugInterval = setInterval(() => this.logMemoryUsage(), 5 * 1000);
            this.logMemoryUsage(); // Initial log
        }
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

    private async refreshCache(): Promise<void> {
        if (this.isRefreshing) {
            // If a refresh is already in progress, wait for it to complete
            return this.refreshPromise || Promise.resolve();
        }

        this.isRefreshing = true;
        this.refreshPromise = this._refreshCache();

        try {
            await this.refreshPromise;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    private async _refreshCache(): Promise<void> {
        await QueryCheckJsinfoReadDbInstance();

        let newSpecCache = await RedisCache.getArray("SpecTable") as string[] | null;
        let newConsumerCache = await RedisCache.getArray("ConsumerTable") as string[] | null;

        if (!newSpecCache || newSpecCache.length === 0 || this.specCache.length === 0) {
            this.specCache = await this.fetchSpecTable();
            RedisCache.setArray("SpecTable", this.specCache, this.refreshInterval);
        } else {
            this.specCache = newSpecCache;
        }

        if (!newConsumerCache || newConsumerCache.length === 0 || this.consumerCache.length === 0) {
            this.consumerCache = await this.fetchConsumerTable();
            RedisCache.setArray("ConsumerTable", this.consumerCache, this.refreshInterval);
        } else {
            this.consumerCache = newConsumerCache;
        }
    }

    public IsValidSpec(specId: string): boolean {
        if (!this.GetAllSpecs().includes(specId.toUpperCase())) {
            return false;
        }
        return true;
    }

    public IsValidConsumer(consumer: string): boolean {
        if (!this.GetAllConsumers().includes(consumer.toLowerCase())) {
            return false;
        }
        return true;
    }

    public GetAllSpecs(): string[] {
        if (this.specCache.length === 0) {
            this.refreshCache();
        }
        // TODO: remove once merged with ts branch
        return this.specCache.length === 0 ? ["EVMOS", "STRGZ"] : this.specCache;
    }

    public GetAllConsumers(): string[] {
        if (this.consumerCache.length === 0) {
            this.refreshCache();
        }
        return this.consumerCache;
    }

    private async fetchSpecTable(): Promise<string[]> {
        const db = QueryGetJsinfoReadDbInstance();

        const specsFromStakes = await db
            .select({ specId: JsinfoSchema.providerStakes.specId })
            .from(JsinfoSchema.providerStakes)
            .groupBy(JsinfoSchema.providerStakes.specId);

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const specsFromHealth = await db
            .select({ specId: JsinfoSchema.providerHealth.spec })
            .from(JsinfoSchema.providerHealth)
            .where(sql`${JsinfoSchema.providerHealth.timestamp} >= ${threeMonthsAgo}`)
            .groupBy(JsinfoSchema.providerHealth.spec);

        const allSpecs = [...specsFromStakes, ...specsFromHealth]
            .map(spec => spec.specId)
            .filter((specId): specId is string => specId !== null)
            .map(specId => specId.toUpperCase());

        return Array.from(new Set(allSpecs));
    }

    private async fetchConsumerTable(): Promise<string[]> {
        const consumers = await QueryGetJsinfoReadDbInstance()
            .select({ consumer: JsinfoSchema.consumerSubscriptionList.consumer })
            .from(JsinfoSchema.consumerSubscriptionList)
            .groupBy(JsinfoSchema.consumerSubscriptionList.consumer);

        const uniqueConsumers = new Set(consumers.map(c => c.consumer.toLowerCase()));

        return Array.from(uniqueConsumers);
    }
}

export const SpecAndConsumerCache = new SpecAndConsumerCacheClass();

// Clean up on process exit
process.on('exit', () => {
    SpecAndConsumerCache.cleanup();
});