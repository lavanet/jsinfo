// src/query/classes/QueryProviderMonikerCache.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';
import { IsIndexerProcess } from '../../utils/utils';

if (IsIndexerProcess()) {
    throw new Error('MonikerCache should not be used in the indexer');
}

import { JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE } from '../queryConsts';
import { logClassMemory } from './MemoryLogger';
import { GetJsinfoDbForQuery } from '../../utils/dbUtils';
import { logger } from '../../utils/utils';
import { desc, sql } from 'drizzle-orm';

interface ProviderSpecMoniker {
    provider: string;
    moniker: string | null;
    spec: string | null;
}

class ProviderSpecMonikerCache {
    private psmCache: Map<string, ProviderSpecMoniker> = new Map();
    private psmCacheIsEmpty: boolean = false;
    private refreshInterval = 2 * 60 * 1000;
    private monikerForProviderCache: Map<string, string> = new Map();
    private monikerFullDescriptionCache: Map<string, string> = new Map();
    private debugInterval: NodeJS.Timer | null = null;
    private fetchPromise: Promise<ProviderSpecMoniker[]> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);

        if (JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE) {
            this.debugInterval = setInterval(() => this.logMemoryUsage(), 5 * 1000);
            this.logMemoryUsage(); // Initial log
        }
    }

    private logMemoryUsage() {
        logClassMemory({
            className: 'MonikerCache',
            caches: [
                this.psmCache,
                this.monikerForProviderCache,
                this.monikerFullDescriptionCache
            ],
            cacheNames: ['psm', 'provider', 'description']
        });
    }

    public cleanup() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
        }
    }

    private refreshCacheSync() {
        setInterval(() => this.refreshCache(), 0);
    }

    private async refreshCache() {
        let new_psmCache = await RedisCache.getDict("ProviderSpecMonikerTable") as Record<string, ProviderSpecMoniker> | null;

        if (!new_psmCache || Object.keys(new_psmCache).length === 0 || this.psmCacheIsEmpty || this.psmCache.size === 0) {
            const fetchedData = await this.fetchProviderSpecMonikerTable();
            this.psmCache = new Map(fetchedData.map(item => [this.getCacheKey(item), item]));
            if (this.psmCache.size === 0) {
                this.psmCacheIsEmpty = true;
            }
            await RedisCache.setDict("ProviderSpecMonikerTable", Object.fromEntries(this.psmCache), this.refreshInterval);
        } else {
            this.psmCache = new Map(Object.entries(new_psmCache));
        }

        this.monikerForProviderCache.clear();
        this.monikerFullDescriptionCache.clear();
    }

    private getCacheKey(item: ProviderSpecMoniker): string {
        return `${item.provider}-${item.spec || ''}`;
    }

    public GetMonikerForSpec(lavaid: string | null, spec: string | null): string {
        if (!lavaid) {
            return '';
        }

        lavaid = this.verifyLavaId(lavaid);

        if (!spec) {
            return this.GetMonikerForProvider(lavaid);
        }

        if (this.psmCache.size === 0) {
            this.refreshCacheSync();
            if (this.psmCacheIsEmpty) {
                return '';
            }
        }

        spec = spec.toUpperCase();

        const key = `${lavaid}-${spec}`;
        const item = this.psmCache.get(key);
        if (item) {
            return this.sanitizeAndTrimMoniker(item.moniker || '');
        }

        return this.GetMonikerForProvider(lavaid);
    }

    public GetMonikerForProvider(lavaid: string | null): string {
        if (!lavaid) {
            return '';
        }

        lavaid = this.verifyLavaId(lavaid);

        if (this.psmCache.size === 0) {
            this.refreshCacheSync();
            if (this.psmCacheIsEmpty) {
                return '';
            }
        }

        if (this.monikerForProviderCache.has(lavaid)) {
            let ret = this.monikerForProviderCache.get(lavaid);
            if (ret) return ret;
        }

        const monikerCounts = new Map<string, number>();
        let highestCountMoniker = '';
        let highestCount = 0;

        for (const [key, item] of this.psmCache) {
            if (item.provider === lavaid && item.moniker) {
                const count = (monikerCounts.get(item.moniker) || 0) + 1;
                monikerCounts.set(item.moniker, count);

                if (count > highestCount) {
                    highestCount = count;
                    highestCountMoniker = item.moniker;
                }
            }
        }

        const result = this.sanitizeAndTrimMoniker(highestCountMoniker);

        this.monikerForProviderCache.set(lavaid.toLowerCase(), result);
        return result;
    }

    public GetMonikerFullDescription(lavaid: string | null): string {
        if (!lavaid) return '';

        lavaid = this.verifyLavaId(lavaid);

        if (this.psmCache.size === 0) {
            this.refreshCacheSync()
            if (this.psmCacheIsEmpty) return '';
        }

        if (this.monikerFullDescriptionCache.has(lavaid)) {
            let ret = this.monikerFullDescriptionCache.get(lavaid);
            if (ret) return ret;
        }

        const filtered = Array.from(this.psmCache.values()).filter(item => item.provider === lavaid);
        if (filtered.length === 0) {
            return '';
        }

        const monikerToSpecs = filtered.reduce((acc, item) => {
            if (item.moniker && item.moniker.trim() !== '') {
                const sanitizedMoniker = this.sanitizeAndTrimMoniker(item.moniker);
                if (!acc[sanitizedMoniker]) {
                    acc[sanitizedMoniker] = [];
                }
                if (item.spec && !acc[sanitizedMoniker].includes(item.spec)) {
                    acc[sanitizedMoniker].push(item.spec);
                }
            }
            return acc;
        }, {} as { [moniker: string]: string[] });

        if (Object.keys(monikerToSpecs).length === 1) {
            const result = Object.keys(monikerToSpecs)[0];
            this.monikerFullDescriptionCache.set(lavaid, result);
            return result;
        }

        const entries = Object.entries(monikerToSpecs)
            .map(([moniker, specs]) => `${moniker} (${specs.join(', ')})`);

        const result = entries.length > 5
            ? entries.slice(0, 5).join("\n") + "\n..."
            : entries.join("\n");

        this.monikerFullDescriptionCache.set(lavaid, result);
        return result;
    }

    public GetMonikerCountForProvider(lavaid: string): number {
        if (this.psmCache.size === 0) {
            this.refreshCacheSync()
            if (this.psmCacheIsEmpty) return 0;
        }
        if (!lavaid) return 0;
        lavaid = this.verifyLavaId(lavaid);
        return Array.from(this.psmCache.values()).filter(item => item.provider === lavaid).length;
    }

    public GetAllProviders(): string[] {
        if (this.psmCache.size === 0) {
            this.refreshCacheSync();
            if (this.psmCacheIsEmpty) return [];
        }

        const uniqueProviders = new Set<string>();
        Array.from(this.psmCache.values()).forEach(item => {
            if (item.provider) {
                uniqueProviders.add(item.provider.toLowerCase());
            }
        });

        return Array.from(uniqueProviders);
    }

    private verifyLavaId(lavaid: string): string {
        lavaid = lavaid.toLowerCase();
        if (!lavaid.startsWith('lava@')) {
            throw new Error('Input must start with "lava@".');
        }
        return lavaid;
    }

    private sanitizeAndTrimMoniker(moniker: string): string {
        if (moniker === null || moniker.trim() === "") {
            return "";
        }
        if (moniker.length > 100) {
            return moniker.substring(0, 97) + " ...";
        }
        return moniker.replace(/['"<>#;]|--/g, '');
    }

    private async fetchProviderSpecMonikerTable(): Promise<ProviderSpecMoniker[]> {
        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        this.fetchPromise = this._fetchProviderSpecMonikerTable().finally(() => {
            this.fetchPromise = null;
        });

        return this.fetchPromise;
    }

    private async _fetchProviderSpecMonikerTable(): Promise<ProviderSpecMoniker[]> {
        logger.info('Fetch started for ProviderSpecMonikerTable');

        let db = await GetJsinfoDbForQuery();
        try {
            const results = await db
                .select({
                    provider: JsinfoSchema.providerSpecMoniker.provider,
                    specId: JsinfoSchema.providerSpecMoniker.spec,
                    moniker: JsinfoSchema.providerSpecMoniker.moniker
                })
                .from(JsinfoSchema.providerSpecMoniker)
                .groupBy(
                    JsinfoSchema.providerSpecMoniker.provider,
                    JsinfoSchema.providerSpecMoniker.spec,
                    JsinfoSchema.providerSpecMoniker.moniker
                )
                .orderBy(desc(sql`MAX(${JsinfoSchema.providerSpecMoniker.updatedAt})`));

            logger.info('Fetch ended for ProviderSpecMonikerTable');

            return results.map(item => ({
                ...item,
                provider: item.provider.toLowerCase(),
                spec: item.specId ? item.specId.toUpperCase() : null,
            }));
        } catch (error) {
            logger.error('Failed to fetch ProviderSpecMoniker data:', error);
            throw error;
        }
    }

    public IsValidProvider(lavaid: string): boolean {
        lavaid = this.verifyLavaId(lavaid);
        return Array.from(this.psmCache.values()).some(item => item.provider === lavaid);
    }
}

process.on('exit', () => {
    MonikerCache.cleanup();
});

export const MonikerCache = IsIndexerProcess() ? (null as unknown as ProviderSpecMonikerCache) : new ProviderSpecMonikerCache();
