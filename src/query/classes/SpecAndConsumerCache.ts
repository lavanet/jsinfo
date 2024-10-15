// src/query/classes/SpecAndConsumerCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import { sql } from 'drizzle-orm';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';
import { logger } from '../../utils/utils'

class SpecAndConsumerCacheClass {
    private specCache: string[] = [];
    private consumerCache: string[] = [];
    private refreshInterval = 2 * 60 * 1000;
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<void> | null = null;

    public constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
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
            logger.info('Fetching new consumer data from database');
            this.consumerCache = await this.fetchConsumerTable();
            RedisCache.setArray("ConsumerTable", this.consumerCache, this.refreshInterval);
        } else {
            this.consumerCache = newConsumerCache;
        }

        // logger.info('SpecAndConsumerCache refresh completed');
    }

    public IsValidSpec(specId: string): boolean {
        if (!this.specCache.includes(specId.toUpperCase())) {
            this.refreshCache();
            return false;
        }
        return true;
    }

    public IsValidConsumer(consumer: string): boolean {
        if (!this.consumerCache.includes(consumer.toLowerCase())) {
            this.refreshCache();
            return false;
        }
        return true;
    }

    public GetAllSpecs(): string[] {
        if (this.specCache.length === 0) {
            this.refreshCache();
        }
        return this.specCache;
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