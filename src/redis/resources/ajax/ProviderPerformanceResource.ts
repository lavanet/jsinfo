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

export class ProviderPerformanceResource extends RedisResourceBase<ProviderPerformanceData[], {}> {
    protected readonly redisKey = 'provider-performance';
    protected readonly cacheExpirySeconds = 300; // 5 minutes cache

    protected async fetchFromSource(): Promise<ProviderPerformanceData[]> {
        try {
            const [aprResource, providersResource, rewardsLastMonth] = await Promise.all([
                new AllProviderAPRResource().fetch(),
                new ListProvidersResource().fetch(),
                MainnetProviderEstimatedRewardsGetService.fetch({ block: 2044223 })
            ]);

            if (!aprResource || !providersResource) {
                throw new Error('Failed to fetch provider data');
            }

            // Create maps for quick lookup
            const providersMap = new Map(
                providersResource.providers.map(p => [p.provider, p])
            );

            const rewardsMap = new Map(
                (rewardsLastMonth?.data?.providers || []).map(p => [p.address, p.rewards_by_block])
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

    private processRewardsBySpec(rewardsByBlock: any): Array<{
        chain: string;
        spec: string;
        tokens: RewardToken[];
        total_usd: number;
        icon?: string;
    }> {
        const specRewards = new Map<string, { tokens: RewardToken[]; total_usd: Decimal }>();

        if (!rewardsByBlock?.info) {
            return [];
        }

        const { info } = rewardsByBlock;

        info.forEach((reward: any) => {
            const [type, spec] = reward.source.toLowerCase().split(': ');
            if (!spec) return;

            const key = spec;
            const existing = specRewards.get(key) || { tokens: [], total_usd: new Decimal(0) };

            reward.amount.tokens.forEach((token: any) => {
                const existingToken = existing.tokens.find(t => t.source_denom === token.source_denom);
                if (existingToken) {
                    try {
                        const existingResolved = existingToken.resolved_amount || '0';
                        const newResolved = token.resolved_amount || '0';
                        const newResolvedAmount = new Decimal(existingResolved)
                            .plus(new Decimal(newResolved))
                            .toString();

                        const existingDisplay = existingToken.display_amount || '0';
                        const newDisplay = token.display_amount || '0';
                        const newDisplayAmount = new Decimal(existingDisplay)
                            .plus(new Decimal(newDisplay))
                            .toString();

                        const existingUsd = new Decimal(existingToken.value_usd?.slice(1) || '0');
                        const newUsd = new Decimal(token.value_usd?.slice(1) || '0');
                        const totalUsd = existingUsd.plus(newUsd);

                        existingToken.resolved_amount = newResolvedAmount;
                        existingToken.display_amount = newDisplayAmount;
                        existingToken.value_usd = `$${totalUsd.toFixed(2)}`;
                    } catch (error) {
                        logger.warn('Error processing token values:', {
                            error,
                            existingToken,
                            newToken: token,
                            context: 'processRewardsBySpec'
                        });
                    }
                } else {
                    existing.tokens.push({ ...token });
                }
            });

            try {
                const rewardUsd = new Decimal(reward.amount.total_usd || 0);
                existing.total_usd = existing.total_usd.plus(rewardUsd);
            } catch (error) {
                logger.warn('Error processing total USD:', {
                    error,
                    reward,
                    context: 'processRewardsBySpec_totalUsd'
                });
            }

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