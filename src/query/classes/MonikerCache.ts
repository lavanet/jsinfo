// src/query/classes/MonikerCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { gte } from 'drizzle-orm';

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
    private pmCache: ProviderMoniker[] = [];
    private refreshInterval = 2 * 60 * 1000;
    private monikerForProviderCache: Map<string, string> = new Map();
    private monikerFullDescriptionCache: Map<string, string> = new Map();

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
    }

    private async refreshCache() {
        await QueryCheckJsinfoReadDbInstance();
        this.psmCache = await this.fetchProviderSpecMonikerTable();
        this.pmCache = await this.fetchProviderMonikerTable();
        this.monikerForProviderCache.clear();
        this.monikerFullDescriptionCache.clear();
    }

    public GetMonikerForProvider(lavaid: string | null): string {
        if (this.psmCache.length === 0 && this.pmCache.length === 0) throw new Error('Cache is not populated');
        if (!lavaid) return '';
        this.verifyLavaId(lavaid);

        if (this.monikerForProviderCache.has(lavaid)) {
            return this.monikerForProviderCache.get(lavaid)!;
        }

        const filtered = this.psmCache.filter(item => item.provider === lavaid);
        if (filtered.length === 0) {
            // If not found in psmCache, try pmCache
            const filtered2 = this.pmCache.filter(item => item.address === lavaid);
            if (filtered2.length === 0) return '';
            return filtered2[0].moniker || '';
        }

        const monikerCounts = filtered.reduce((acc, curr) => {
            acc[curr.moniker!] = (acc[curr.moniker!] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        const highestCountMoniker = Object.keys(monikerCounts).reduce((a, b) => monikerCounts[a] > monikerCounts[b] ? a : b);
        const result = this.sanitizeAndTrimMoniker(highestCountMoniker);

        this.monikerForProviderCache.set(lavaid, result);
        return result;
    }

    public GetMonikerFullDescription(lavaid: string | null): string {
        if (this.psmCache.length === 0 && this.pmCache.length === 0) throw new Error('Cache is not populated');
        if (!lavaid) return '';
        this.verifyLavaId(lavaid);

        if (this.monikerFullDescriptionCache.has(lavaid)) {
            return this.monikerFullDescriptionCache.get(lavaid)!;
        }

        const filtered = this.psmCache.filter(item => item.provider === lavaid);
        if (filtered.length === 0) {
            // If not found in psmCache, try pmCache
            const filtered2 = this.pmCache.filter(item => item.address === lavaid);
            if (filtered2.length === 0) return '';
            return filtered2[0].moniker || '';
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
            const result = monikerToSpecIds[0][0];
            this.monikerFullDescriptionCache.set(lavaid, result);
            return result;
        }

        const result = Object.entries(monikerToSpecIds)
            .map(([moniker, specIds]) => `${moniker} (${specIds.join(', ')})`)
            .join("\n");

        this.monikerFullDescriptionCache.set(lavaid, result);
        return result;
    }

    public GetMonikerCountForProvider(lavaid: string): number {
        if (this.psmCache.length === 0 && this.pmCache.length === 0) throw new Error('Cache is not populated');
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
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        return await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerSpecMoniker)
            .where(gte(JsinfoSchema.providerSpecMoniker.updatedAt, twoDaysAgo));
    }

    private async fetchProviderMonikerTable(): Promise<ProviderMoniker[]> {
        return await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers);
    }
}

export const MonikerCache = new ProviderSpecMonikerCache();