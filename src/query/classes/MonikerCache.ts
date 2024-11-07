// src/query/classes/MonikerCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';
import { GetIsIndexerProcess } from '../../utils/utils';
import { JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE } from '../queryConsts';
import { logClassMemory } from './MemoryLogger';

if (GetIsIndexerProcess()) {
    throw new Error('MonikerCache should not be used in the indexer');
}

interface ProviderSpecMoniker {
    provider: string;
    moniker: string | null;
    specId: string | null;
    id: number;
    createdAt: Date;
    updatedAt: Date | null;
}

class ProviderSpecMonikerCache {
    private psmCache: Map<string, ProviderSpecMoniker> = new Map();
    private psmCacheIsEmpty: boolean = false;
    private refreshInterval = 2 * 60 * 1000;
    private monikerForProviderCache: Map<string, string> = new Map();
    private monikerFullDescriptionCache: Map<string, string> = new Map();
    private debugInterval: NodeJS.Timer | null = null;

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

    private async refreshCache() {
        await QueryCheckJsinfoReadDbInstance();

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
        return `${item.provider}-${item.specId || ''}`;
    }

    public GetMonikerForSpec(lavaid: string | null, spec: string | null): string {
        if (!lavaid) {
            return '';
        }

        lavaid = this.verifyLavaId(lavaid);

        if (!spec) {
            return this.GetMonikerForProvider(lavaid);
        }

        spec = spec.toUpperCase();

        if (this.psmCache.size === 0) {
            this.refreshCache();
            if (this.psmCacheIsEmpty) {
                return '';
            }
        }

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
            this.refreshCache();
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
            this.refreshCache()
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

        const monikerToSpecIds = filtered.reduce((acc, item) => {
            if (item.moniker && item.moniker.trim() !== '') {
                const sanitizedMoniker = this.sanitizeAndTrimMoniker(item.moniker);
                if (!acc[sanitizedMoniker]) {
                    acc[sanitizedMoniker] = [];
                }
                if (item.specId && !acc[sanitizedMoniker].includes(item.specId)) {
                    acc[sanitizedMoniker].push(item.specId);
                }
            }
            return acc;
        }, {} as { [moniker: string]: string[] });

        if (Object.keys(monikerToSpecIds).length === 1) {
            const result = Object.keys(monikerToSpecIds)[0];
            this.monikerFullDescriptionCache.set(lavaid, result);
            return result;
        }

        const entries = Object.entries(monikerToSpecIds)
            .map(([moniker, specIds]) => `${moniker} (${specIds.join(', ')})`);

        const result = entries.length > 5
            ? entries.slice(0, 5).join("\n") + "\n..."
            : entries.join("\n");

        this.monikerFullDescriptionCache.set(lavaid, result);
        return result;
    }

    public GetMonikerCountForProvider(lavaid: string): number {
        if (this.psmCache.size === 0) {
            this.refreshCache()
            if (this.psmCacheIsEmpty) return 0;
        }
        if (!lavaid) return 0;
        lavaid = this.verifyLavaId(lavaid);
        return Array.from(this.psmCache.values()).filter(item => item.provider === lavaid).length;
    }

    public GetAllProviders(): string[] {
        if (this.psmCache.size === 0) {
            this.refreshCache();
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
        const results = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerSpecMoniker);
        return results.map(item => ({
            ...item,
            provider: item.provider.toLowerCase(),
            specId: item.specId ? item.specId.toUpperCase() : null
        }));
    }

    public IsValidProvider(lavaid: string): boolean {
        lavaid = this.verifyLavaId(lavaid);
        return Array.from(this.psmCache.values()).some(item => item.provider === lavaid);
    }
}

export const MonikerCache = new ProviderSpecMonikerCache();

process.on('exit', () => {
    MonikerCache.cleanup();
});