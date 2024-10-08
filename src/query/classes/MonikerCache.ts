// src/query/classes/MonikerCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';

interface ProviderSpecMoniker {
    provider: string;
    moniker: string | null;
    specId: string | null;
    id: number;
    createdAt: Date;
    updatedAt: Date | null;
}

interface ProviderMoniker {
    moniker: string | null;
    address: string | null;
}[]

class ProviderSpecMonikerCache {
    private psmCache: ProviderSpecMoniker[] = [];
    private psmCacheIsEmpty: boolean = false;
    private pmCache: ProviderMoniker[] = [];
    private pmCacheIsEmpty: boolean = false;
    private refreshInterval = 2 * 60 * 1000;
    private monikerForProviderCache: Map<string, string> = new Map();
    private monikerFullDescriptionCache: Map<string, string> = new Map();

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
    }

    private async refreshCache() {
        await QueryCheckJsinfoReadDbInstance();

        let new_psmCache = (await RedisCache.getArray("ProviderSpecMonikerTable") || []) as ProviderSpecMoniker[]

        if ((new_psmCache == null) || (Array.isArray(new_psmCache) && new_psmCache.length === 0) || this.psmCacheIsEmpty || (Array.isArray(this.psmCache) && this.psmCache.length === 0)) {
            this.psmCache = await this.fetchProviderSpecMonikerTable();
            if (Array.isArray(this.psmCache) && this.psmCache.length === 0) {
                this.psmCacheIsEmpty = true;
            }
            RedisCache.setArray("ProviderSpecMonikerTable", this.psmCache, this.refreshInterval);
        } else {
            this.psmCache = new_psmCache
        }

        let new_pmCache = (await RedisCache.getArray("ProviderMonikerTable") || []) as ProviderMoniker[]

        if ((new_pmCache == null) || (Array.isArray(new_pmCache) && new_pmCache.length === 0) || this.pmCacheIsEmpty || (Array.isArray(this.pmCache) && this.pmCache.length === 0)) {
            this.pmCache = await this.fetchProviderMonikerTable();
            if (Array.isArray(this.pmCache) && this.pmCache.length === 0) {
                this.pmCacheIsEmpty = true;
            }
            RedisCache.setArray("ProviderMonikerTable", this.pmCache, this.refreshInterval);
        } else {
            this.pmCache = new_pmCache
        }

        this.monikerForProviderCache.clear();
        this.monikerFullDescriptionCache.clear();
    }

    public GetMonikerForSpec(lavaid: string | null, spec: string | null): string {
        if (!lavaid) {
            return '';
        }

        this.verifyLavaId(lavaid);

        if (!spec) {
            return this.GetMonikerForProvider(lavaid);
        }

        if (this.psmCache.length === 0 && this.pmCache.length === 0) {
            this.refreshCache()
            if (this.psmCacheIsEmpty && this.pmCacheIsEmpty) {
                return '';
            }
        }

        const filtered = this.psmCache.filter(item => item.provider === lavaid && item.specId === spec);
        if (filtered.length === 1) {
            return this.sanitizeAndTrimMoniker(filtered[0].moniker || '');
        }

        return this.GetMonikerForProvider(lavaid);
    }

    public GetMonikerForProvider(lavaid: string | null): string {
        if (!lavaid) {
            return '';
        }

        this.verifyLavaId(lavaid);

        if (this.psmCache.length === 0 && this.pmCache.length === 0) {
            this.refreshCache()
            if (this.psmCacheIsEmpty && this.pmCacheIsEmpty) {
                return '';
            }
        }

        if (this.monikerForProviderCache.has(lavaid)) {
            let ret = this.monikerForProviderCache.get(lavaid)
            if (ret) return ret;
        }

        const filtered = this.psmCache.filter(item => item.provider === lavaid);
        if (filtered.length === 0) {
            // If not found in psmCache, try pmCache
            const filtered2 = this.pmCache.filter(item => item.address === lavaid);
            let ret = '';
            if (filtered2.length != 0) {
                ret = filtered2[0].moniker || '';
            }
            if (ret != '') {
                this.monikerForProviderCache.set(lavaid, ret);
            }
            return ret
        }

        let highestCountMoniker = '';
        let highestCount = 0;
        const monikerCounts = new Map<string, number>();

        filtered.forEach(curr => {
            if (!curr.moniker) return;
            const moniker = curr.moniker;
            const count = (monikerCounts.get(moniker) || 0) + 1;
            monikerCounts.set(moniker, count);

            if (count > highestCount) {
                highestCount = count;
                highestCountMoniker = moniker;
            }
        });

        const result = this.sanitizeAndTrimMoniker(highestCountMoniker);

        this.monikerForProviderCache.set(lavaid, result);
        return result;
    }

    public GetMonikerFullDescription(lavaid: string | null): string {
        if (!lavaid) return '';
        this.verifyLavaId(lavaid);

        if (this.psmCache.length === 0 && this.pmCache.length === 0) {
            this.refreshCache()
            if (this.psmCacheIsEmpty && this.pmCacheIsEmpty) return '';
        }

        if (this.monikerFullDescriptionCache.has(lavaid)) {
            let ret = this.monikerFullDescriptionCache.get(lavaid);
            if (ret) return ret;
        }

        const filtered = this.psmCache.filter(item => item.provider === lavaid);
        if (filtered.length === 0) {
            // If not found in psmCache, try pmCache
            const filtered2 = this.pmCache.filter(item => item.address === lavaid);
            let ret = '';
            if (filtered2.length != 0) ret = filtered2[0].moniker || '';
            if (ret != '') this.monikerFullDescriptionCache.set(lavaid, ret);
            return ret
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
        if (this.psmCache.length === 0) {
            this.refreshCache()
            if (this.psmCacheIsEmpty) return 0;
        }
        if (!lavaid) return 0;
        this.verifyLavaId(lavaid);
        return this.psmCache.filter(item => item.provider === lavaid).length;
    }

    private verifyLavaId(input: string): string {
        if (!input.startsWith('lava@')) {
            throw new Error('Input must start with "lava@".');
        }
        return input;
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
        return await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerSpecMoniker)
    }

    private async fetchProviderMonikerTable(): Promise<ProviderMoniker[]> {
        return await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers);
    }
}

export const MonikerCache = new ProviderSpecMonikerCache();