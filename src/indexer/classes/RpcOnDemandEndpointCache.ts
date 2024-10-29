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

class RpcOnDemandEndpointCacheClass {
    private cacheRefreshInterval = 20 * 60; // 20 minutes

    public async GetDenomTrace(denom: string): Promise<DenomTraceResponse> {
        const cacheKey = `denom_trace_${denom}`;
        let denomTrace = await MemoryCache.get<DenomTraceResponse>(cacheKey);

        if (!denomTrace) {
            await this.fetchAndCacheDenomTrace(denom);
            denomTrace = await MemoryCache.get<DenomTraceResponse>(cacheKey);
            if (!denomTrace) {
                logger.warn('Denom trace not found in cache after refresh');
                return { denom_trace: { path: '', base_denom: '' } };
            }
        }

        return denomTrace;
    }

    private async fetchAndCacheDenomTrace(denom: string): Promise<void> {
        try {
            const response = await QueryLavaRPC<DenomTraceResponse>(`/ibc/apps/transfer/v1/denom_traces/${denom}`);
            await MemoryCache.set(`denom_trace_${denom}`, response, this.cacheRefreshInterval);
            logger.info(`Fetched and cached denom trace for ${denom} successfully.`);
        } catch (error) {
            logger.error(`Error fetching denom trace for ${denom}`, { error: TruncateError(error) });
            throw error;
        }
    }

    public async GetEstimatedValidatorRewards(validator: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
        const cacheKey = `validator_rewards_${validator}_${amount}_${denom}`;
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
            const response = await QueryLavaRPC<EstimatedRewardsResponse>(
                `/lavanet/lava/subscription/estimated_validator_rewards/${validator}/${amount}${denom}`,
                true
            );
            await MemoryCache.set(
                `validator_rewards_${validator}_${amount}_${denom}`,
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
        const cacheKey = `provider_rewards_${provider}_${amount}_${denom}`;
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
            const response = await QueryLavaRPC<EstimatedRewardsResponse>(
                `/lavanet/lava/subscription/estimated_provider_rewards/${provider}/${amount}${denom}`,
                true
            );
            await MemoryCache.set(
                `provider_rewards_${provider}_${amount}_${denom}`,
                response,
                this.cacheRefreshInterval
            );
            // logger.info(`Fetched and cached estimated provider rewards for ${provider}`);
        } catch (error) {
            logger.error(`Error fetching estimated provider rewards for ${provider}`, { error: TruncateError(error) });
            throw error;
        }
    }
}

export const RpcOnDemandEndpointCache = new RpcOnDemandEndpointCacheClass();
