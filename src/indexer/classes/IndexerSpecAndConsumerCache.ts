// src/indexer/classes/IndexerSpecAndConsumerCache.ts

import { sql } from 'drizzle-orm';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { IsIndexerProcess } from '@jsinfo/utils/env';
import { logger } from '@jsinfo/utils/logger';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

class SpecAndConsumerCacheClass {
    private specCache: string[] = [];
    private consumerCache: string[] = [];
    private lastSpecRefreshTime: number = 0;
    private lastConsumerRefreshTime: number = 0;
    private refreshInterval = 2 * 60 * 1000; // 2 minutes
    private currentSpecRefresh: Promise<void> | null = null;
    private currentConsumerRefresh: Promise<void> | null = null;

    public async GetAllSpecs(db: PostgresJsDatabase): Promise<string[]> {
        logger.info(`GetAllSpecs called. Current cache size: ${this.specCache.length}`);

        if (this.shouldRefreshSpecs()) {
            if (!this.currentSpecRefresh) {
                this.currentSpecRefresh = this.fetchSpecTable(db)
                    .then(results => {
                        this.specCache = results;
                        this.lastSpecRefreshTime = Date.now();
                        logger.info(`Specs cache refreshed. New size: ${results.length}`);
                    })
                    .finally(() => {
                        this.currentSpecRefresh = null;
                    });
            }
            await this.currentSpecRefresh;
        }

        return this.specCache;
    }

    public async GetAllConsumers(db: PostgresJsDatabase): Promise<string[]> {
        logger.info(`GetAllConsumers called. Current cache size: ${this.consumerCache.length}`);

        if (this.shouldRefreshConsumers()) {
            if (!this.currentConsumerRefresh) {
                this.currentConsumerRefresh = this.fetchConsumerTable(db)
                    .then(results => {
                        this.consumerCache = results;
                        this.lastConsumerRefreshTime = Date.now();
                        logger.info(`Consumers cache refreshed. New size: ${results.length}`);
                    })
                    .finally(() => {
                        this.currentConsumerRefresh = null;
                    });
            }
            await this.currentConsumerRefresh;
        }

        return this.consumerCache;
    }

    private shouldRefreshSpecs(): boolean {
        return Date.now() - this.lastSpecRefreshTime >= this.refreshInterval ||
            this.specCache.length === 0;
    }

    private shouldRefreshConsumers(): boolean {
        return Date.now() - this.lastConsumerRefreshTime >= this.refreshInterval ||
            this.consumerCache.length === 0;
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

        return consumers.map(c => c.consumer.toLowerCase());
    }
}

export const SpecAndConsumerCache = IsIndexerProcess() ? new SpecAndConsumerCacheClass() : (null as unknown as SpecAndConsumerCacheClass);
