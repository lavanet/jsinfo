import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { desc, inArray } from 'drizzle-orm';
import { queryJsinfo } from '@jsinfo/utils/db';
import GetIconForSpec from '@jsinfo/lib/icons/icons';
import { ConvertToChainName } from '@jsinfo/lib/chain-mapping/chains';

export interface ProviderEntry {
    provider: string;
    specs: {
        chain: string;
        spec: string | null;
        stakestatus: string | null;
        stake: string | null;
        addons: string | null;
        extensions: string | null;
        delegateCommission: string | null;
        delegateTotal: string | null;
        moniker: string;
        icon?: string;
    }[];
}

export interface ProvidersData {
    height: number;
    datetime: number;
    providers: ProviderEntry[];
}

const LavaProviderStakeStatusDict: { [key: number]: string } = {
    [JsinfoSchema.LavaProviderStakeStatus.Active]: "Active",
    [JsinfoSchema.LavaProviderStakeStatus.Frozen]: "Frozen",
    [JsinfoSchema.LavaProviderStakeStatus.Unstaking]: "Unstaking",
    [JsinfoSchema.LavaProviderStakeStatus.Inactive]: "Inactive",
    [JsinfoSchema.LavaProviderStakeStatus.Jailed]: "Jailed",
};

export class ListProvidersResource extends RedisResourceBase<ProvidersData, {}> {
    protected redisKey = 'listProviders';
    protected cacheExpirySeconds = 300; // 5 minutes cache

    protected async fetchFromSource(): Promise<ProvidersData> {
        const stakesRes = await queryJsinfo(
            async (db) => db.select({
                provider: JsinfoSchema.providerStakes.provider,
                specId: JsinfoSchema.providerStakes.specId,
                status: JsinfoSchema.providerStakes.status,
                stake: JsinfoSchema.providerStakes.stake,
                addons: JsinfoSchema.providerStakes.addons,
                extensions: JsinfoSchema.providerStakes.extensions,
                delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
                delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
            }).from(JsinfoSchema.providerStakes)
                .where(inArray(JsinfoSchema.providerStakes.status, [JsinfoSchema.LavaProviderStakeStatus.Active, JsinfoSchema.LavaProviderStakeStatus.Frozen, JsinfoSchema.LavaProviderStakeStatus.Jailed])),
            'ListProvidersResource_fetchFromSource'
        );

        // First get all monikers
        const monikerPromises = stakesRes.map(stake =>
            ProviderMonikerService.GetMonikerForSpec(stake.provider, stake.specId)
        );
        const monikers = await Promise.all(monikerPromises);

        // Then use them in reduce
        const providers = stakesRes.reduce<ProviderEntry[]>((acc, stake, index) => {
            const providerEntry = acc.find(entry => entry.provider === stake.provider);
            const specEntry: ProviderEntry['specs'][0] = {
                chain: stake.specId ? ConvertToChainName(stake.specId) || "" : "",
                spec: stake.specId || '',
                stakestatus: stake.status ? LavaProviderStakeStatusDict[stake.status] || "" : "",
                stake: stake.stake?.toString() ?? '',
                addons: stake.addons || '',
                extensions: stake.extensions || '',
                delegateCommission: stake.delegateCommission?.toString() ?? '',
                delegateTotal: stake.delegateTotal?.toString() ?? '',
                moniker: monikers[index]
            };

            // Get the icon
            const icon = GetIconForSpec(stake.specId);
            if (icon) {
                specEntry.icon = icon;
            }

            if (providerEntry) {
                providerEntry.specs.push(specEntry);
            } else {
                acc.push({
                    provider: stake.provider!,
                    specs: [specEntry]
                });
            }
            return acc;
        }, []).sort((a, b) => a.provider.localeCompare(b.provider));

        const latestDbBlocks = await queryJsinfo(
            async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
            'ListProvidersResource_latestDbBlocks'
        );
        let latestHeight = 0
        let latestDatetime = 0
        if (latestDbBlocks.length != 0) {
            latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
            latestDatetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime()
        }

        return {
            height: latestHeight,
            datetime: latestDatetime,
            providers
        };
    }
} 