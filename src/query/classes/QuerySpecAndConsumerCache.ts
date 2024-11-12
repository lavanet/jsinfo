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
    private isRefreshing: boolean = false;
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
        if (this.isRefreshing) {
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
        const maxRetries = 3;
        let retryCount = 0;
        let lastError: Error | null = null;
        const allSpecs: string[] = [];
        const chunkSize = 500;
        let offset = 0;

        while (retryCount < maxRetries) {
            let db = await GetJsinfoDbForQuery();
            try {
                while (true) {
                    const chunkResults = await db
                        .select({ specId: JsinfoSchema.providerStakes.specId })
                        .from(JsinfoSchema.providerStakes)
                        .groupBy(JsinfoSchema.providerStakes.specId)
                        .limit(chunkSize)
                        .offset(offset);

                    if (chunkResults.length === 0) {
                        break; // No more results
                    }

                    allSpecs.push(...chunkResults.map(spec => spec.specId!.toUpperCase()));
                    offset += chunkSize;
                }

                // Include specs from providerHealth table
                offset = 0;
                const threeMonthsAgo = GetUtcNow();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

                while (true) {
                    const healthResults = await db
                        .select({ specId: JsinfoSchema.providerHealth.spec })
                        .from(JsinfoSchema.providerHealth)
                        .where(sql`${JsinfoSchema.providerHealth.timestamp} >= ${threeMonthsAgo}`)
                        .groupBy(JsinfoSchema.providerHealth.spec)
                        .limit(chunkSize)
                        .offset(offset);

                    if (healthResults.length === 0) {
                        break; // No more results
                    }

                    allSpecs.push(...healthResults.map(spec => spec.specId!.toUpperCase()));
                    offset += chunkSize;
                }

                break; // Exit retry loop if successful
            } catch (error) {
                lastError = error as Error;
                logger.error(`Error fetching spec table data (attempt ${retryCount + 1}/${maxRetries}):`, lastError);
                retryCount++;

                if (retryCount < maxRetries) {
                    const delay = 1000 * retryCount; // Exponential backoff
                    logger.info(`Retrying in ${delay}ms...`);
                    await Sleep(delay);
                }
            }
        }

        if (allSpecs.length === 0 && lastError) {
            logger.error(`Failed to fetch spec data after ${maxRetries} attempts`);
            throw lastError;
        }

        return Array.from(new Set(allSpecs));
    }

    private async fetchConsumerTable(): Promise<string[]> {
        const maxRetries = 3;
        let retryCount = 0;
        let lastError: Error | null = null;
        const allConsumers: string[] = [];
        const chunkSize = 500;
        let offset = 0;

        while (retryCount < maxRetries) {
            let db = await GetJsinfoDbForQuery();
            try {
                while (true) {
                    const chunkResults = await db
                        .select({ consumer: JsinfoSchema.consumerSubscriptionList.consumer })
                        .from(JsinfoSchema.consumerSubscriptionList)
                        .groupBy(JsinfoSchema.consumerSubscriptionList.consumer)
                        .limit(chunkSize)
                        .offset(offset);

                    if (chunkResults.length === 0) {
                        break; // No more results
                    }

                    allConsumers.push(...chunkResults.map(c => c.consumer.toLowerCase()));
                    offset += chunkSize;
                }

                break; // Exit retry loop if successful
            } catch (error) {
                lastError = error as Error;
                logger.error(`Error fetching consumer data (attempt ${retryCount + 1}/${maxRetries}):`, lastError);
                retryCount++;

                if (retryCount < maxRetries) {
                    const delay = 1000 * retryCount; // Exponential backoff
                    logger.info(`Retrying in ${delay}ms...`);
                    await Sleep(delay);
                }
            }
        }

        if (allConsumers.length === 0 && lastError) {
            logger.error(`Failed to fetch consumer data after ${maxRetries} attempts`);
            throw lastError;
        }

        return Array.from(new Set(allConsumers));
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
