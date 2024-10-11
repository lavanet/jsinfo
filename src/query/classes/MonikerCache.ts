// src/query/classes/MonikerCache.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';
import { IsIndexerProcess, Sleep } from '../../utils/utils'; // Assuming you have a sleep utility function
import { GetJsinfoDb } from '../../utils/dbUtils';

interface ProviderSpecMoniker {
    provider: string;
    moniker: string | null;
    spec: string | null;
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
    private isFetching: boolean = false;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
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

        const monikerTospecs = filtered.reduce((acc, item) => {
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

        if (Object.keys(monikerTospecs).length === 1) {
            const result = Object.keys(monikerTospecs)[0];
            this.monikerFullDescriptionCache.set(lavaid, result);
            return result;
        }

        const entries = Object.entries(monikerTospecs)
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
        if (this.isFetching) {
            // console.log("Fetch already in progress, waiting...");
            return [];
        }

        this.isFetching = true;
        try {
            const maxRetries = 3;
            let retryCount = 0;
            let lastError: Error | null = null;
            let allResults: ProviderSpecMoniker[] = [];
            const chunkSize = 500;
            let offset = 0;

            while (retryCount < maxRetries) {
                let db = await GetJsinfoDb();
                try {
                    while (true) {
                        const chunkResults = await db.select()
                            .from(JsinfoSchema.providerSpecMoniker)
                            .limit(chunkSize)
                            .offset(offset);

                        if (chunkResults.length === 0) {
                            break; // No more results
                        }

                        allResults = allResults.concat(chunkResults);
                        offset += chunkSize;
                    }

                    console.log(`Successfully fetched all ${allResults.length} ProviderSpecMoniker records`);
                    break; // Exit retry loop if successful
                } catch (error) {
                    lastError = error as Error;
                    console.error(`Error fetching ProviderSpecMoniker data (attempt ${retryCount + 1}/${maxRetries}):`, lastError);
                    retryCount++;

                    if (retryCount < maxRetries) {
                        const delay = 1000 * retryCount; // Exponential backoff
                        console.log(`Retrying in ${delay}ms...`);
                        await Sleep(delay);
                    }
                }
            }

            if (allResults.length === 0 && lastError) {
                console.error(`Failed to fetch ProviderSpecMoniker data after ${maxRetries} attempts`);
                throw lastError;
            }

            let ret = allResults.map(item => ({
                ...item,
                provider: item.provider.toLowerCase(),
                spec: item.spec ? item.spec.toUpperCase() : null
            }));

            return ret;
        } finally {
            this.isFetching = false;
        }
    }

    public IsValidProvider(lavaid: string): boolean {
        lavaid = this.verifyLavaId(lavaid);
        return Array.from(this.psmCache.values()).some(item => item.provider === lavaid);
    }
}

export const MonikerCache = IsIndexerProcess() ? (null as unknown as ProviderSpecMonikerCache) : new ProviderSpecMonikerCache();