// src/restRpc/MainnetEstimatedProviderRewardsRpc.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaMainnetRPC } from '@jsinfo/restRpc/Mainnet/MainnetLavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { IsMeaningfulText, TruncateError } from '@jsinfo/utils/fmt';
import { EstimatedRewardsResponse } from '../LavaRpcOnDemandEndpointCache';

const CACHE_KEYS = {
    MAINNET_PROVIDER_REWARDS_NO_AMOUNT_NO_DENOM: (provider: string) =>
        `mainnet_provider_rewards_no_amount_no_denom:${provider}`,
} as const;

// Keep existing functions
export async function MainnetGetEstimatedProviderRewardsNoAmountNoDenom(provider: string): Promise<EstimatedRewardsResponse> {
    if (!IsMeaningfulText(provider)) {
        throw new Error(`Invalid provider: ${provider}`);
    }

    const cacheKey = CACHE_KEYS.MAINNET_PROVIDER_REWARDS_NO_AMOUNT_NO_DENOM(provider);
    let rewards = await RedisCache.getDict(cacheKey) as EstimatedRewardsResponse;

    if (!rewards) {
        try {
            const response = await QueryLavaMainnetRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_provider_rewards/${provider}/`);
            rewards = response;
            RedisCache.setDict(cacheKey, response, 30 * 60);
        } catch (error) {
            logger.error(`Error fetching estimated provider rewards for ${provider}`, { error: TruncateError(error) });
            return { info: [], total: [], recommended_block: "0" };
        }
    }

    return rewards || { info: [], total: [], recommended_block: "0" };
}