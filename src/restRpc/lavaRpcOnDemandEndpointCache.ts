// src/indexer/classes/RpcEndpointCahce.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/lavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { IsMeaningfulText, TruncateError } from '@jsinfo/utils/fmt';
import { IsMainnet } from '@jsinfo/utils/env';

export interface DenomTraceResponse {
    denom_trace: {
        path: string;
        base_denom: string;
    }
}

export interface EstimatedRewardsResponse {
    info: {
        source: string;
        amount: {
            denom: string;
            amount: string;
        };
    }[];
    total: {
        denom: string;
        amount: string;
    }[];
    recommended_block: string;
}

export interface DelegatorRewardAmount {
    denom: string;
    amount: string;
}
export interface DelegatorReward {
    provider: string;
    amount: DelegatorRewardAmount[];
}
export interface DelegatorRewardsResponse {
    rewards: DelegatorReward[];
}

export interface SpecTrackedInfoResponse {
    info: {
        provider: string;
        chain_id: string;
        base_pay: {
            total: string;
            totalAdjusted: string;
            iprpc_cu: string;
        };
    }[];
}

export interface PoolBalance {
    denom: string;
    amount: string;
}

export interface Pool {
    name: string;
    balance: PoolBalance[];
}

export interface RewardsPoolsResponse {
    pools: Pool[];
    time_to_refill: string;
    estimated_blocks_to_refill: string;
    allocation_pool_months_left: string;
}

export interface StakingPoolResponse {
    pool: {
        not_bonded_tokens: string;
        bonded_tokens: string;
    }
}

export interface ValidatorDistributionInfoResponse {
    operator_address: string;
    self_bond_rewards: {
        denom: string;
        amount: string;
    }[];
    commission: {
        denom: string;
        amount: string;
    }[];
}

const CACHE_KEYS = {
    DENOM_TRACE: (denom: string) => `denom_trace:${denom}`,
    VALIDATOR_REWARDS: (validator: string, amount: number, denom: string) =>
        `validator_rewards:${validator}:${amount}:${denom}`,
    PROVIDER_REWARDS: (provider: string, amount: number, denom: string) =>
        `provider_rewards:${provider}:${amount}:${denom}`,
    DELEGATOR_REWARDS: (delegator: string) => `delegator_rewards:${delegator}`,
    SPEC_TRACKED_INFO: (chainId: string) => `spec_tracked_info:${chainId}`,
    DISTRIBUTED_PROVIDER_REWARDS: (provider: string) =>
        `distributed_provider_rewards:${provider}`,
    VALIDATOR_DISTRIBUTION_INFO: (validator: string) =>
        `validator_distribution_info:${validator}`,
} as const;

class RpcOnDemandEndpointCacheClass {
    private cacheRefreshInterval = 30 * 60; // 0 minutes

    public async GetDenomTrace(denom: string): Promise<DenomTraceResponse> {
        const cacheKey = CACHE_KEYS.DENOM_TRACE(denom);
        let denomTrace = await RedisCache.getDict(cacheKey) as DenomTraceResponse;

        if (!denomTrace) {
            denomTrace = await this.fetchAndCacheDenomTrace(denom);
            if (!denomTrace) {
                logger.warn('Denom trace not found in cache after refresh', { cacheKey, denom, denomTrace });
                return { denom_trace: { path: '', base_denom: '' } };
            }
        }

        return denomTrace;
    }

    private async fetchAndCacheDenomTrace(denom: string): Promise<DenomTraceResponse> {
        if (IsMainnet() && denom.includes("E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F")) {
            throw new Error(`lavaRpcOnDemandEndpointCache:: Using testnet denom on mainnet - something is wrong - ${denom} (samoleans)`);
        }
        try {
            const response = await QueryLavaRPC<DenomTraceResponse>(`/ibc/apps/transfer/v1/denom_traces/${denom}`);
            RedisCache.setDict(CACHE_KEYS.DENOM_TRACE(denom), response, this.cacheRefreshInterval);
            return response;
        } catch (error) {
            logger.error(`Error fetching denom trace for ${denom}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetEstimatedValidatorRewards(validator: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
        const cacheKey = CACHE_KEYS.VALIDATOR_REWARDS(validator, amount, denom);
        let rewards = await RedisCache.getDict(cacheKey) as EstimatedRewardsResponse;

        if (!rewards) {
            return await this.fetchAndCacheEstimatedValidatorRewards(validator, amount, denom);
        }

        return rewards;
    }

    private async fetchAndCacheEstimatedValidatorRewards(validator: string, amount: number, denom: string, retries: number = 10, delay: number = 1000): Promise<EstimatedRewardsResponse> {
        let attempt = 0;

        if (!IsMeaningfulText(validator) || !IsMeaningfulText(denom)) {
            throw new Error(`lavaRpcOnDemandEndpointCache::GetEstimatedValidatorRewards: Invalid validator or denom: ${validator} ${denom}`);
        }

        while (attempt < retries) {
            try {
                const response = await QueryLavaRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_validator_rewards/${validator}/${amount}${denom}`);
                RedisCache.setDict(
                    CACHE_KEYS.VALIDATOR_REWARDS(validator, amount, denom),
                    response,
                    this.cacheRefreshInterval
                );
                return response; // Exit the function if successful
            } catch (error) {
                attempt++;
                logger.error(`Error fetching estimated validator rewards for ${validator} on attempt ${attempt}`, { error: TruncateError(error) });

                if (attempt >= retries) {
                    logger.error(`Failed to fetch estimated validator rewards for ${validator} after ${retries} attempts.`);
                    throw error; // Rethrow the error after exhausting retries
                }

                await new Promise(resolve => setTimeout(resolve, delay)); // Wait for the specified delay (in milliseconds)
            }
        }
        throw new Error(`Failed to fetch estimated validator rewards for ${validator} after ${retries} attempts.`);
    }

    public async GetEstimatedProviderRewards(provider: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
        if (!IsMeaningfulText(provider) || !IsMeaningfulText(denom)) {
            throw new Error(`lavaRpcOnDemandEndpointCache::GetEstimatedProviderRewards: Invalid validator or denom: ${provider} ${denom}`);
        }

        const cacheKey = CACHE_KEYS.PROVIDER_REWARDS(provider, amount, denom);
        let rewards = await RedisCache.getDict(cacheKey) as EstimatedRewardsResponse;

        if (!rewards) {
            try {
                rewards = await this.fetchEstimatedProviderRewards(provider, amount, denom);
            } catch (error) {
                logger.error(`Error fetching estimated provider rewards for ${provider}`, { error: TruncateError(error) });
                return { info: [], total: [], recommended_block: "0" };

            }
            if (!rewards) {
                return { info: [], total: [], recommended_block: "0" };
            }
        }

        return rewards;
    }

    private async fetchEstimatedProviderRewards(provider: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
        try {
            const response = await QueryLavaRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_provider_rewards/${provider}/${amount}${denom}`);
            RedisCache.setDict(
                CACHE_KEYS.PROVIDER_REWARDS(provider, amount, denom),
                response,
                this.cacheRefreshInterval
            );
            return response;
        } catch (error) {
            logger.error(`Error fetching estimated provider rewards for ${provider}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetDelegatorRewards(delegator: string): Promise<DelegatorRewardsResponse> {
        const cacheKey = CACHE_KEYS.DELEGATOR_REWARDS(delegator);
        let rewards = await RedisCache.getDict(cacheKey) as DelegatorRewardsResponse;

        if (!rewards) {
            rewards = await this.fetchAndCacheDelegatorRewards(delegator);
        }

        return rewards || { rewards: [] };
    }

    private async fetchAndCacheDelegatorRewards(delegator: string): Promise<DelegatorRewardsResponse> {
        const cacheKey = CACHE_KEYS.DELEGATOR_REWARDS(delegator);
        try {
            const response = await QueryLavaRPC<DelegatorRewardsResponse>(
                `/lavanet/lava/dualstaking/delegator_rewards/${delegator}`
            );

            if (response.rewards && response.rewards.length > 0) {
                const mappedRewards = await Promise.all(response.rewards.map(async (reward) => {
                    const results = await Promise.all(reward.amount.map(async (amt) => {
                        if (amt.denom.startsWith('ibc/')) {
                            const hash = amt.denom.replace('ibc/', '');
                            const denomTrace = await this.GetDenomTrace(hash);
                            return {
                                denom: denomTrace.denom_trace.base_denom,
                                amount: amt.amount
                            };
                        }
                        return amt;
                    }));

                    return {
                        provider: reward.provider,
                        amount: results
                    };
                }));

                const finalResponse = { rewards: mappedRewards };

                RedisCache.setDict(cacheKey, finalResponse, this.cacheRefreshInterval);
                return finalResponse;
            }

            // Cache empty response as well
            RedisCache.setDict(cacheKey, response, this.cacheRefreshInterval);
            return response;

        } catch (error) {
            logger.error(`Error fetching delegator rewards for ${delegator}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetSpecTrackedInfo(chainId: string): Promise<SpecTrackedInfoResponse> {
        const cacheKey = CACHE_KEYS.SPEC_TRACKED_INFO(chainId);
        let specTrackedInfo = await RedisCache.getDict(cacheKey) as SpecTrackedInfoResponse;

        if (!specTrackedInfo) {
            specTrackedInfo = await this.fetchAndCacheSpecTrackedInfo(chainId);
            if (!specTrackedInfo) {
                logger.warn(`SpecTrackedInfo not found in cache after refresh for ${chainId}`);
                return { info: [] };
            }
        }

        return specTrackedInfo;
    }

    private async fetchAndCacheSpecTrackedInfo(chainId: string): Promise<SpecTrackedInfoResponse> {
        try {
            const response = await QueryLavaRPC<SpecTrackedInfoResponse>(`/lavanet/lava/rewards/SpecTrackedInfo/${chainId}/`);
            RedisCache.setDict(CACHE_KEYS.SPEC_TRACKED_INFO(chainId), response, this.cacheRefreshInterval);
            return response;
        } catch (error) {
            logger.error(`Error fetching SpecTrackedInfo for ${chainId}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetRewardsPools(): Promise<RewardsPoolsResponse> {
        const cacheKey = 'rewards_pools';
        let rewardsPools = await RedisCache.getDict(cacheKey) as RewardsPoolsResponse;

        if (!rewardsPools) {
            rewardsPools = await this.fetchAndCacheRewardsPools();
        }

        return rewardsPools || { pools: [], time_to_refill: '', estimated_blocks_to_refill: '', allocation_pool_months_left: '' };
    }

    private async fetchAndCacheRewardsPools(): Promise<RewardsPoolsResponse> {
        const cacheKey = 'rewards_pools';
        try {
            const response = await QueryLavaRPC<RewardsPoolsResponse>('/lavanet/lava/rewards/pools');
            RedisCache.setDict(cacheKey, response, this.cacheRefreshInterval);
            return response;
        } catch (error) {
            logger.error(`Error fetching rewards pools`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetStakingPool(): Promise<StakingPoolResponse> {
        const cacheKey = 'staking_pool';
        let stakingPool = await RedisCache.getDict(cacheKey) as StakingPoolResponse;

        if (!stakingPool) {
            stakingPool = await this.fetchAndCacheStakingPool();
            if (!stakingPool) {
                logger.warn('Staking pool not found in cache after refresh');
                return { pool: { not_bonded_tokens: "0", bonded_tokens: "0" } };
            }
        }

        return stakingPool;
    }

    private async fetchAndCacheStakingPool(): Promise<StakingPoolResponse> {
        try {
            const response = await QueryLavaRPC<StakingPoolResponse>('/cosmos/staking/v1beta1/pool');
            RedisCache.setDict('staking_pool', response, this.cacheRefreshInterval);
            return response;
        } catch (error) {
            logger.error('Error fetching staking pool', { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetDistributedProviderRewards(provider: string): Promise<EstimatedRewardsResponse> {
        const cacheKey = CACHE_KEYS.DISTRIBUTED_PROVIDER_REWARDS(provider);
        let rewards = await RedisCache.getDict(cacheKey) as EstimatedRewardsResponse;

        if (!rewards) {
            rewards = await this.fetchAndCacheDistributedProviderRewards(provider);
        }

        return rewards;
    }

    private async fetchAndCacheDistributedProviderRewards(provider: string): Promise<EstimatedRewardsResponse> {
        try {
            const initialResponse = await QueryLavaRPC<EstimatedRewardsResponse>(
                `/lavanet/lava/subscription/estimated_provider_rewards/${provider}`
            );

            if (!initialResponse.recommended_block) {
                throw new Error('No recommended block received');
            }

            const recommendedBlock = parseInt(initialResponse.recommended_block);
            if (isNaN(recommendedBlock)) {
                throw new Error('Invalid recommended block received');
            }

            if (recommendedBlock === 0) {
                throw new Error('Recommended block is 0');
            }

            const recommendedBlockMinusOne = recommendedBlock - 1;

            const DistributedRewards = await QueryLavaRPC<EstimatedRewardsResponse>(
                `/lavanet/lava/subscription/estimated_provider_rewards/${provider}?height=${recommendedBlockMinusOne}`,
            );

            // Cache the results
            RedisCache.setDict(
                CACHE_KEYS.DISTRIBUTED_PROVIDER_REWARDS(provider),
                DistributedRewards,
                this.cacheRefreshInterval
            );

            return DistributedRewards;
        } catch (error) {
            logger.error(`Error fetching distributed provider rewards for ${provider}`, {
                error: TruncateError(error)
            });
            throw error;
        }
    }
}

export const RpcOnDemandEndpointCache = new RpcOnDemandEndpointCacheClass();
