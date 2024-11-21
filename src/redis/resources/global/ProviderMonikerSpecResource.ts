import { RedisResourceBase } from '../../classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { desc, sql } from 'drizzle-orm';

interface ProviderSpecMoniker {
    provider: string;
    moniker: string | null;
    spec: string | null;
}

interface ProviderMonikerSpecData {
    providers: ProviderSpecMoniker[];
}

export class ProviderMonikerSpecResource extends RedisResourceBase<ProviderMonikerSpecData, {}> {
    protected redisKey = 'providerMonikerSpec';
    protected ttlSeconds = 600; // 10 minutes cache

    private sanitizeAndTrimMoniker(moniker: string): string {
        if (moniker === null || moniker.trim() === "") {
            return "";
        }
        if (moniker.length > 100) {
            return moniker.substring(0, 97) + " ...";
        }
        return moniker.replace(/['"<>#;]|--/g, '');
    }

    private verifyLavaId(lavaid: string): string {
        lavaid = lavaid.toLowerCase();
        if (!lavaid.startsWith('lava@')) {
            throw new Error('Input must start with "lava@".');
        }
        return lavaid;
    }

    protected async fetchFromDb(): Promise<ProviderMonikerSpecData> {
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

        const uniqueMap = new Map<string, ProviderSpecMoniker>();

        results.forEach(item => {
            const key = `${item.provider.toLowerCase()}-${item.specId?.toUpperCase() || ''}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, {
                    provider: item.provider.toLowerCase(),
                    spec: item.specId ? item.specId.toUpperCase() : null,
                    moniker: this.sanitizeAndTrimMoniker(item.moniker || '')
                });
            }
        });

        return {
            providers: Array.from(uniqueMap.values())
        };
    }

    public async GetMonikerForSpec(provider: string | null, spec: string | null): Promise<string> {
        const data = await this.fetch();
        if (!data || !provider) return '';

        const providerKey = this.verifyLavaId(provider);
        const specKey = spec?.toUpperCase() || '';

        const entry = data.providers.find(p =>
            p.provider === providerKey && p.spec === specKey
        );

        return entry?.moniker || this.GetMonikerForProvider(provider);
    }

    public async GetMonikerForProvider(provider: string | null): Promise<string> {
        const data = await this.fetch();
        if (!data || !provider) return '';

        const providerKey = this.verifyLavaId(provider);
        const entries = data.providers.filter(p => p.provider === providerKey);

        const monikerCounts = new Map<string, number>();
        let highestCountMoniker = '';
        let highestCount = 0;

        entries.forEach(entry => {
            if (entry.moniker) {
                const count = (monikerCounts.get(entry.moniker) || 0) + 1;
                monikerCounts.set(entry.moniker, count);

                if (count > highestCount) {
                    highestCount = count;
                    highestCountMoniker = entry.moniker;
                }
            }
        });

        return highestCountMoniker;
    }

    public async GetMonikerFullDescription(provider: string | null): Promise<string> {
        const data = await this.fetch();
        if (!data || !provider) return '';

        const providerKey = this.verifyLavaId(provider);

        const filtered = data.providers.filter(item => item.provider === providerKey);
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
            return Object.keys(monikerToSpecs)[0];
        }

        const entries = Object.entries(monikerToSpecs)
            .map(([moniker, specs]) => `${moniker} (${specs.join(', ')})`);

        return entries.length > 5
            ? entries.slice(0, 5).join("\n") + "\n..."
            : entries.join("\n");
    }

    public async GetAllProviders(): Promise<string[]> {
        const data = await this.fetch();
        if (!data) return [];

        const uniqueProviders = new Set<string>();
        data.providers.forEach(item => {
            if (item.provider) {
                uniqueProviders.add(item.provider.toLowerCase());
            }
        });

        return Array.from(uniqueProviders);
    }

    public async IsValidProvider(provider: string): Promise<boolean> {
        const data = await this.fetch();
        if (!data) return false;

        return data.providers.some(p => p.provider === provider);
    }
}

export const ProviderMonikerService = new ProviderMonikerSpecResource();