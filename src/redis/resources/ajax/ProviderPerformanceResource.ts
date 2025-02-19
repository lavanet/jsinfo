import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { AllProviderAPRResource } from '@jsinfo/redis/resources/ajax/AllProviderAprResource';
import { ListProvidersResource } from '@jsinfo/redis/resources/ajax/ListProvidersResource';
import { MainnetProviderEstimatedRewardsGetService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';
import { GetProviderAvatar } from '@jsinfo/restRpc/GetProviderAvatar';
import { ConvertToChainName } from '@jsinfo/lib/chain-mapping/chains';
import GetIconForSpec from '@jsinfo/lib/icons/icons';
import { logger } from '@jsinfo/utils/logger';
import Decimal from 'decimal.js';

interface RewardToken {
    source_denom: string;
    resolved_amount: string;
    resolved_denom: string;
    display_denom: string;
    display_amount: string;
    value_usd: string;
}

interface ProviderPerformanceData {
    address: string;
    moniker: string;
    apr: string;
    commission: string;
    '30_days_cu_served': string;
    rewards_10k_lava_delegation: RewardToken[];
    '30_days_relays_served': string;
    specs?: Array<{
        chain: string;
        spec: string;
        stakestatus: string;
        stake: string;
        addons: string;
        extensions: string;
        delegateCommission: string;
        delegateTotal: string;
        moniker: string;
        icon?: string;
    }>;
    stake?: string;
    stakestatus?: string;
    addons?: string;
    extensions?: string;
    delegateTotal?: string;
    rewards_last_month: Array<{
        chain: string;
        spec: string;
        tokens: RewardToken[];
        total_usd: number;
        icon?: string;
    }>;
    avatar?: string | null;
}

interface RewardInfo {
    source: string;
    amount: {
        tokens: RewardToken[];
        total_usd: number;
    };
}

interface RewardBlockInfo {
    info: RewardInfo[];
    total: {
        tokens: RewardToken[];
        total_usd: number;
    };
    recommended_block: string;
}

export class ProviderPerformanceResource extends RedisResourceBase<ProviderPerformanceData[], {}> {
    protected readonly redisKey = 'provider-performance-v5';
    protected readonly cacheExpirySeconds = 7200 * 3; // 6 hours cache

    protected async fetchFromSource(): Promise<ProviderPerformanceData[]> {
        try {

            const [aprResource, providersResource, rewardsLastMonth] = await Promise.all([
                new AllProviderAPRResource().fetch(),
                new ListProvidersResource().fetch(),
                MainnetProviderEstimatedRewardsGetService.fetch({ block: 'latest_distributed' })
            ]);

            if (!aprResource || !providersResource) {
                throw new Error('Failed to fetch provider data');
            }

            // Create maps for quick lookup
            const providersMap = new Map(
                providersResource.providers.map(p => [p.provider, p])
            );

            const rewardsLastMonthBlock = rewardsLastMonth?.data?.metadata.block_info?.height;
            if (!rewardsLastMonthBlock) {
                throw new Error('Failed to fetch rewards last month block');
            }

            const rewardsMap = new Map(
                (rewardsLastMonth?.data?.providers || []).map(p => [
                    p.address,
                    p.rewards_by_block[rewardsLastMonthBlock]  // Extract the block data here
                ])
            );

            // Process data
            const combinedData = await Promise.all(aprResource.map(async apr => {
                const provider = providersMap.get(apr.address);
                const rewards_last_month = this.processRewardsBySpec(rewardsMap.get(apr.address));
                const avatar = await GetProviderAvatar(apr.address);

                return {
                    ...apr,
                    apr: apr.apr || '',
                    commission: apr.commission || '',
                    '30_days_cu_served': apr['30_days_cu_served'] || '',
                    rewards_10k_lava_delegation: apr.rewards_10k_lava_delegation,
                    rewards_last_month,
                    '30_days_relays_served': apr['30_days_relays_served'] || '',
                    specs: (provider?.specs || []).map(spec => ({
                        chain: spec.chain,
                        spec: spec.spec || '',
                        stakestatus: spec.stakestatus || '',
                        stake: spec.stake || '',
                        addons: spec.addons || '',
                        extensions: spec.extensions || '',
                        delegateCommission: spec.delegateCommission || '',
                        delegateTotal: spec.delegateTotal || '',
                        moniker: spec.moniker,
                        icon: spec.icon
                    })),
                    stake: provider?.specs?.[0]?.stake || '',
                    stakestatus: provider?.specs?.[0]?.stakestatus || '',
                    addons: provider?.specs?.[0]?.addons || '',
                    extensions: provider?.specs?.[0]?.extensions || '',
                    delegateTotal: provider?.specs?.[0]?.delegateTotal || '',
                    avatar
                };
            }));

            return combinedData;

        } catch (error) {
            logger.error('Error fetching provider performance data:', error);
            throw error;
        }
    }

    private processRewardsBySpec(rewardBlock: RewardBlockInfo | undefined): Array<{
        chain: string;
        spec: string;
        tokens: RewardToken[];
        total_usd: number;
        icon?: string;
    }> {
        if (!rewardBlock?.info) {
            logger.warn('No rewards info found in block');
            return [];
        }

        const specRewards = new Map<string, { tokens: RewardToken[]; total_usd: Decimal }>();

        // Process info array to group by spec
        rewardBlock.info.forEach((reward: RewardInfo) => {
            const [type, spec] = reward.source.split(': ');
            if (!spec) return;

            const key = spec.toLowerCase();
            const existing = specRewards.get(key) || { tokens: [], total_usd: new Decimal(0) };

            // Add tokens from this reward
            reward.amount.tokens.forEach((token: RewardToken) => {
                const existingToken = existing.tokens.find(t => t.source_denom === token.source_denom);
                if (existingToken) {
                    existingToken.resolved_amount = token.resolved_amount;
                    existingToken.display_amount = token.display_amount;
                    existingToken.value_usd = token.value_usd;
                } else {
                    existing.tokens.push({ ...token });
                }
            });

            existing.total_usd = existing.total_usd.plus(new Decimal(reward.amount.total_usd));
            specRewards.set(key, existing);
        });

        return Array.from(specRewards.entries()).map(([spec, data]) => ({
            chain: ConvertToChainName(spec),
            spec: spec.toUpperCase(),
            tokens: data.tokens,
            total_usd: data.total_usd.toNumber(),
            icon: GetIconForSpec(spec)
        }));
    }
}

export const ProviderPerformanceService = new ProviderPerformanceResource(); 