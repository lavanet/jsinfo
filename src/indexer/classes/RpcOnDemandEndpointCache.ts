// src/indexer/classes/RpcEndpointCahce.ts

import { logger, TruncateError } from "../../utils/utils";
import { QueryLavaRPC } from "../utils/restRpc";
import { MemoryCache } from "./MemoryCache";
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

const CACHE_KEYS = {
    DENOM_TRACE: (denom: string) => `denom_trace:${denom}`,
    VALIDATOR_REWARDS: (validator: string, amount: number, denom: string) =>
        `validator_rewards:${validator}:${amount}:${denom}`,
    PROVIDER_REWARDS: (provider: string, amount: number, denom: string) =>
        `provider_rewards:${provider}:${amount}:${denom}`,
    DELEGATOR_REWARDS: (delegator: string) => `delegator_rewards:${delegator}`,
    SPEC_TRACKED_INFO: (chainId: string) => `spec_tracked_info:${chainId}`,
} as const;

class RpcOnDemandEndpointCacheClass {
    private cacheRefreshInterval = 20 * 60; // 20 minutes

    public async GetDenomTrace(denom: string): Promise<DenomTraceResponse> {
        const cacheKey = CACHE_KEYS.DENOM_TRACE(denom);
        let denomTrace = await MemoryCache.get<DenomTraceResponse>(cacheKey);

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
        try {
            const response = await QueryLavaRPC<DenomTraceResponse>(`/ibc/apps/transfer/v1/denom_traces/${denom}`);
            await MemoryCache.set(`denom_trace_${denom}`, response, this.cacheRefreshInterval);
            logger.info(`Fetched and cached denom trace for ${denom} successfully.`);
            return response;
        } catch (error) {
            logger.error(`Error fetching denom trace for ${denom}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetEstimatedValidatorRewards(validator: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
        const cacheKey = CACHE_KEYS.VALIDATOR_REWARDS(validator, amount, denom);
        let rewards = await MemoryCache.get<EstimatedRewardsResponse>(cacheKey);

        if (!rewards) {
            await this.fetchAndCacheEstimatedValidatorRewards(validator, amount, denom);
            rewards = await MemoryCache.get<EstimatedRewardsResponse>(cacheKey);
            if (!rewards) {
                logger.warn(`No estimated validator rewards found in cache for ${validator}`);
                return { info: [], total: [] };
            }
        }

        return rewards;
    }

    private async fetchAndCacheEstimatedValidatorRewards(validator: string, amount: number, denom: string): Promise<void> {
        try {
            const response = await QueryLavaRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_validator_rewards/${validator}/${amount}${denom}`);
            await MemoryCache.set(
                CACHE_KEYS.VALIDATOR_REWARDS(validator, amount, denom),
                response,
                this.cacheRefreshInterval
            );
            // logger.info(`Fetched and cached estimated validator rewards for ${validator}`);
        } catch (error) {
            logger.error(`Error fetching estimated validator rewards for ${validator}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetEstimatedProviderRewards(provider: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
        const cacheKey = CACHE_KEYS.PROVIDER_REWARDS(provider, amount, denom);
        let rewards = await MemoryCache.get<EstimatedRewardsResponse>(cacheKey);

        if (!rewards) {
            await this.fetchEstimatedProviderRewards(provider, amount, denom);
            rewards = await MemoryCache.get<EstimatedRewardsResponse>(cacheKey);
            if (!rewards) {
                logger.warn(`No estimated provider rewards found in cache for ${provider}`);
                return { info: [], total: [] };
            }
        }

        return rewards;
    }

    private async fetchEstimatedProviderRewards(provider: string, amount: number, denom: string): Promise<void> {
        try {
            const response = await QueryLavaRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_provider_rewards/${provider}/${amount}${denom}`);
            await MemoryCache.set(
                CACHE_KEYS.PROVIDER_REWARDS(provider, amount, denom),
                response,
                this.cacheRefreshInterval
            );
            // logger.info(`Fetched and cached estimated provider rewards for ${provider}`);
        } catch (error) {
            logger.error(`Error fetching estimated provider rewards for ${provider}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetDelegatorRewards(delegator: string): Promise<DelegatorRewardsResponse> {
        const cacheKey = CACHE_KEYS.DELEGATOR_REWARDS(delegator);
        let rewards = await MemoryCache.get<DelegatorRewardsResponse>(cacheKey);

        if (!rewards) {
            rewards = await this.fetchAndCacheDelegatorRewards(delegator);
        }

        return rewards || { rewards: [] };
    }

    private async fetchAndCacheDelegatorRewards(delegator: string): Promise<DelegatorRewardsResponse> {
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

                return { rewards: mappedRewards };
            }

            return response;
        } catch (error) {
            logger.error(`Error fetching delegator rewards for ${delegator}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetSpecTrackedInfo(chainId: string): Promise<SpecTrackedInfoResponse> {
        const cacheKey = CACHE_KEYS.SPEC_TRACKED_INFO(chainId);
        let specTrackedInfo = await MemoryCache.get<SpecTrackedInfoResponse>(cacheKey);

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
            await MemoryCache.set(CACHE_KEYS.SPEC_TRACKED_INFO(chainId), response, this.cacheRefreshInterval);
            logger.info(`Fetched and cached SpecTrackedInfo for ${chainId} successfully.`);
            return response;
        } catch (error) {
            logger.error(`Error fetching SpecTrackedInfo for ${chainId}`, { error: TruncateError(error) });
            throw error;
        }
    }
}

export const RpcOnDemandEndpointCache = new RpcOnDemandEndpointCacheClass();
