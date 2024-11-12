// src/indexer/classes/IndexerSpecAndConsumerCache.ts

import { sql } from 'drizzle-orm';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { MemoryCache } from './MemoryCache';
import { IsIndexerProcess, logger } from '../../utils/utils'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

class SpecAndConsumerCacheClass {
    private specCache: string[] = [];
    private consumerCache: string[] = [];
    private refreshInterval = 2 * 60 * 1000; // 2 minutes in milliseconds
    private lastRefreshTime: number = 0;
    private isRefreshing: boolean = false;

    public async GetAllSpecs(db: PostgresJsDatabase): Promise<string[]> {
        await this.refreshCache(db);
        return this.specCache;
    }

    public async GetAllConsumers(db: PostgresJsDatabase): Promise<string[]> {
        await this.refreshCache(db);
        return this.consumerCache;
    }

    private async refreshCache(db: PostgresJsDatabase): Promise<void> {
        const currentTime = Date.now();

        if (currentTime - this.lastRefreshTime < this.refreshInterval) {
            return;
        }

        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;

        try {
            await this._refreshCache(db);
            this.lastRefreshTime = currentTime;
        } finally {
            this.isRefreshing = false;
        }
    }

    private async _refreshCache(db: PostgresJsDatabase): Promise<void> {
        let newSpecCache = await MemoryCache.getArray("SpecTable") as string[] | null;
        let newConsumerCache = await MemoryCache.getArray("ConsumerTable") as string[] | null;

        if (!newSpecCache || newSpecCache.length === 0 || this.specCache.length === 0) {
            this.specCache = await this.fetchSpecTable(db);
            MemoryCache.setArray("SpecTable", this.specCache, this.refreshInterval);
        } else {
            this.specCache = newSpecCache;
        }

        if (!newConsumerCache || newConsumerCache.length === 0 || this.consumerCache.length === 0) {
            logger.info('Fetching new consumer data from database');
            this.consumerCache = await this.fetchConsumerTable(db);
            MemoryCache.setArray("ConsumerTable", this.consumerCache, this.refreshInterval);
        } else {
            this.consumerCache = newConsumerCache;
        }

        logger.info('SpecAndConsumerCache refresh completed');
    }

    private async fetchSpecTable(db: PostgresJsDatabase): Promise<string[]> {
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

    private async fetchConsumerTable(db: PostgresJsDatabase): Promise<string[]> {
        const consumers = await db
            .select({ consumer: JsinfoSchema.consumerSubscriptionList.consumer })
            .from(JsinfoSchema.consumerSubscriptionList)
            .groupBy(JsinfoSchema.consumerSubscriptionList.consumer);

        const uniqueConsumers = new Set(consumers.map(c => c.consumer.toLowerCase()));

        return Array.from(uniqueConsumers);
    }
}

export const SpecAndConsumerCache = IsIndexerProcess() ? new SpecAndConsumerCacheClass() : (null as unknown as SpecAndConsumerCacheClass);
