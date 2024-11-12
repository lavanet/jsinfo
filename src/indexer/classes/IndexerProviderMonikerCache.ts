// src/indexer/classes/IndexerProviderMonikerCache.ts
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { MemoryCache } from './MemoryCache';
import { IsIndexerProcess, logger } from '../../utils/utils';

class ProviderMonikerCacheClass {
    private providerCache: string[] = [];
    private refreshInterval = 2 * 60 * 1000; // 2 minutes in milliseconds
    private lastRefreshTime: number = 0;
    private isRefreshing: boolean = false;

    public async GetAllProviders(db: PostgresJsDatabase): Promise<string[]> {
        await this.refreshCache(db);
        return this.providerCache;
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
        let newProviderCache = await MemoryCache.getArray("ProviderTable") as string[] | null;

        if (!newProviderCache || newProviderCache.length === 0 || this.providerCache.length === 0) {
            logger.info('Fetching new provider data from database');
            this.providerCache = await this.fetchProviderTable(db);
            MemoryCache.setArray("ProviderTable", this.providerCache, this.refreshInterval);
        } else {
            this.providerCache = newProviderCache;
        }

        logger.info('ProviderMonikerCache refresh completed');
    }

    private async fetchProviderTable(db: PostgresJsDatabase): Promise<string[]> {
        const providers = await db
            .select({ provider: JsinfoSchema.providerSpecMoniker.provider })
            .from(JsinfoSchema.providerSpecMoniker)
            .groupBy(JsinfoSchema.providerSpecMoniker.provider);

        const uniqueProviders = new Set(providers.map(p => p.provider.toLowerCase()));

        return Array.from(uniqueProviders);
    }
}

export const ProviderMonikerCache = IsIndexerProcess() ? new ProviderMonikerCacheClass() : (null as unknown as ProviderMonikerCacheClass);