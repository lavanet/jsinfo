// src/indexer/classes/RpcEndpointCahce.ts

import { IsMeaningfulText, logger } from "../../utils/utils";
import { QueryLavaRPC } from "../rpcUtils";
import { MemoryCache } from "../classes/MemoryCache";

interface Delegation {
    provider: string;
    chainID: string;
    delegator: string;
    amount: {
        denom: string;
        amount: string;
    };
    timestamp: string;
}

interface ProviderDelegatorsResponse {
    delegations: Delegation[];
}

interface Reward {
    provider: string;
    chain_id: string;
    amount: {
        denom: string;
        amount: string;
    }[];
}



interface ProviderMetadata {
    provider: string;
    vault: string;
    total_delegations: {
        denom: string;
        amount: string;
    };
    chains: string[];
    delegate_commission: string;
    last_change: string;
    description: {
        moniker: string;
        identity: string;
        website: string;
        security_contact: string;
        details: string;
    };
}

interface ProviderMetadataResponse {
    MetaData: ProviderMetadata[];
}

class RpcEndpointCacheClass {
    private providerAndDelegatorRefreshInterval = 20 * 60; // 20 minutes
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.providerAndDelegatorRefreshInterval * 1000);
    }

    private async refreshCache(): Promise<void> {
        if (this.isRefreshing) {
            return this.refreshPromise || Promise.resolve();
        }

        this.isRefreshing = true;
        this.refreshPromise = this._refreshCache();

        try {
            await this.refreshPromise;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    private async _refreshCache(): Promise<void> {
        try {
            await this.fetchAndCacheProviders();
            await this.fetchAndCacheDelegators();
        } catch (error) {
            logger.error('Error refreshing unique delegators and providers cache', { error });
        }
    }

    private async fetchAndCacheProviders(): Promise<void> {
        try {
            const response = await this.GetProviderMetadata();
            const providers = response.MetaData.map((meta) => meta.provider);
            await MemoryCache.setArray('providers', providers, this.providerAndDelegatorRefreshInterval);

            logger.info('Providers cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching providers metadata', { error });
        }
    }

    private async fetchAndCacheDelegators(): Promise<void> {
        try {
            const cachedProviders = await MemoryCache.getArray<string>('providers');
            if (!cachedProviders) {
                logger.warn('No providers found in cache. Skipping delegator fetching.');
                return;
            }

            const cachedDelegators = await MemoryCache.getArray('uniqueDelegators');
            if (cachedDelegators) {
                return;
            }
            const uniqueDelegators = new Set<string>();

            for (const provider of cachedProviders) {
                const delegators = await this.GetProviderDelegators(provider);
                for (const delegation of delegators.delegations) {
                    if (IsMeaningfulText(delegation.delegator)) {
                        uniqueDelegators.add(delegation.delegator);
                    }
                }

                // Cache the delegations for each provider for future queries.
                await MemoryCache.set(`provider_delegations_${provider}`, delegators.delegations, this.providerAndDelegatorRefreshInterval);
            }

            await MemoryCache.setArray('uniqueDelegators', Array.from(uniqueDelegators), this.providerAndDelegatorRefreshInterval);

            logger.info('UniqueDelegatorsCache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching and caching unique delegators', { error });
        }
    }

    public async GetUniqueDelegators(): Promise<string[]> {
        const delegators = await MemoryCache.getArray<string>('uniqueDelegators');
        if (!delegators) {
            await this.refreshCache();
            return await MemoryCache.getArray<string>('uniqueDelegators') || [];
        }
        return delegators;
    }

    public async GetProviders(): Promise<string[]> {
        const providers = await MemoryCache.getArray<string>('providers');
        if (!providers) {
            await this.refreshCache();
            return await MemoryCache.getArray<string>('providers') || [];
        }
        return providers;
    }

    public async GetTotalDelegatedAmount(provider: string, from?: number): Promise<bigint> {
        const delegations = await MemoryCache.get<Delegation[]>(`provider_delegations_${provider}`);
        if (!delegations) {
            logger.warn(`No delegations found for provider ${provider}.`);
            return BigInt(0);
        }

        const totalAmount = delegations.reduce((sum, delegation) => {
            // Filter by timestamp if 'from' is provided.
            if (from && Number(delegation.timestamp) < from) {
                return sum;
            }

            // Accumulate the amount.
            return sum + BigInt(delegation.amount.amount);
        }, BigInt(0));

        return totalAmount;
    }

    private async GetProviderDelegators(provider: string): Promise<ProviderDelegatorsResponse> {
        const cacheKey = `provider_delegators_${provider}`;
        let delegators = await MemoryCache.get<ProviderDelegatorsResponse>(cacheKey);

        if (!delegators) {
            delegators = await QueryLavaRPC<ProviderDelegatorsResponse>(
                `/lavanet/lava/dualstaking/provider_delegators/${provider}`
            );
            await MemoryCache.set(cacheKey, delegators, this.providerAndDelegatorRefreshInterval);
        }

        return delegators;
    }

    private async GetProviderMetadata(): Promise<ProviderMetadataResponse> {
        const cacheKey = `provider_metadata`;
        let metadata = await MemoryCache.get<ProviderMetadataResponse>(cacheKey);

        if (!metadata) {
            metadata = await QueryLavaRPC<ProviderMetadataResponse>(`/lavanet/lava/epochstorage/provider_metadata/`);
            await MemoryCache.set(cacheKey, metadata, this.providerAndDelegatorRefreshInterval);
        }

        return metadata;
    }
}

export const RpcEndpointCache = new RpcEndpointCacheClass();


// interface DelegatorRewardsResponse {
//     rewards: Reward[];
// }

// // Refresh the rewards for each unique delegator
// for (const delegator of uniqueDelegators) {
//     await this.fetchAndCacheDelegatorRewards(delegator);
// }

// private async fetchAndCacheDelegatorRewards(delegator: string): Promise<void> {
//     try {
//         const rewards = await this.GetDelegatorRewards(delegator);
//         await MemoryCache.setDict(`delegator_rewards_${delegator}`, rewards, this.rewardRefreshInterval);
//     } catch (error) {
//         logger.error(`Failed to fetch or cache rewards for delegator ${delegator}`, { error });
//     }
// }


// public async GetRewardsForDelegator(delegator: string): Promise<DelegatorRewardsResponse | null> {
//     const rewards = await MemoryCache.getDict<DelegatorRewardsResponse>(`delegator_rewards_${delegator}`);
//     if (!rewards) {
//         await this.fetchAndCacheDelegatorRewards(delegator);
//         return await MemoryCache.getDict<DelegatorRewardsResponse>(`delegator_rewards_${delegator}`) || null;
//     }
//     return rewards;
// }

// private async GetDelegatorRewards(delegator: string): Promise<DelegatorRewardsResponse> {
//     return QueryLavaRPC<DelegatorRewardsResponse>(`/lavanet/lava/dualstaking/delegator_rewards/${delegator}`);
// }
