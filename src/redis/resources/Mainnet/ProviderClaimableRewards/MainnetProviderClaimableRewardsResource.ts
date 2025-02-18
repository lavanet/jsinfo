import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import { RpcOnDemandEndpointCache } from '@jsinfo/restRpc/LavaRpcOnDemandEndpointCache';
import { ConvertToBaseDenom, GetUSDCValue } from '@jsinfo/restRpc/CurrencyConverstionUtils';
import { logger } from '@jsinfo/utils/logger';

interface ProcessedRewardAmount {
    amount: string;
    denom: string;
    usdcValue: string;
    provider: string;
}

interface ProviderRewardData {
    providers: {
        [key: string]: {
            rewards: ProcessedRewardAmount[];
            timestamp: string;
        };
    };
}

export class MainnetProviderClaimableRewardsResource extends RedisResourceBase<ProviderRewardData, {}> {
    protected readonly redisKey = 'mainnet-provider-claimable-rewards';
    protected readonly cacheExpirySeconds = 7200 * 3; // 6 hours

    protected async fetchFromSource(): Promise<ProviderRewardData> {
        try {
            const activeProviders = await ActiveProvidersService.fetch();
            if (!activeProviders) {
                return { providers: {} };
            }

            const providers: Record<string, { rewards: ProcessedRewardAmount[], timestamp: string }> = {};

            for (const provider of activeProviders) {
                try {
                    const rewards = await RpcOnDemandEndpointCache.GetDelegatorRewards(provider);
                    const processedRewards: ProcessedRewardAmount[] = [];

                    for (const reward of rewards.rewards) {
                        if (reward.provider === provider) {
                            for (const rewardAmount of reward.amount) {
                                const [amount, denom] = await ConvertToBaseDenom(rewardAmount.amount, rewardAmount.denom);
                                if (amount === "0") continue;

                                const usdcAmount = await GetUSDCValue(amount, denom);
                                processedRewards.push({
                                    amount: amount.toString(),
                                    denom,
                                    usdcValue: usdcAmount,
                                    provider: reward.provider
                                });
                            }
                        }
                    }

                    providers[provider] = {
                        rewards: processedRewards,
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    logger.error('Failed to fetch rewards for provider:', {
                        provider,
                        error
                    });
                }
            }

            return {
                providers
            };
        } catch (error) {
            logger.error('Failed to fetch all provider rewards:', error);
            throw error;
        }
    }
}

export const ProviderClaimableRewardsService = new MainnetProviderClaimableRewardsResource();
