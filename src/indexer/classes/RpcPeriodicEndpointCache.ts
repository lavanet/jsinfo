// src/indexer/classes/RpcEndpointCahce.ts

import { IsMeaningfulText, logger, TruncateError } from "../../utils/utils";
import { QueryLavaRPC } from "../utils/restRpc";
import { MemoryCache } from "./MemoryCache";

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

interface AllValidatorsResponse {
    validators: {
        operator_address: string;
        consensus_pubkey: {
            "@type": string;
            [key: string]: string;
        };
        jailed: boolean;
        status: string;
        tokens: string;
        delegator_shares: string;
        description: {
            moniker: string;
            identity: string;
            website: string;
            security_contact: string;
            details: string;
        };
        unbonding_height: string;
        unbonding_time: string;
        commission: {
            commission_rates: {
                rate: string;
                max_rate: string;
                max_change_rate: string;
            };
            update_time: string;
        };
        min_self_delegation: string;
        unbonding_on_hold_ref_count: string;
        unbonding_ids: string[];
    }[];
    pagination: {
        next_key: string;
        total: string;
    };
}

class RpcPeriodicEndpointCacheClass {
    private cacheRefreshInterval = 20 * 60; // 20 minutes
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.cacheRefreshInterval * 1000);
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
            await this.fetchAndCacheEmptyProviderDelegations();
            await this.fetchAndCacheValidators();
        } catch (error) {
            logger.error('Error refreshing cache', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheProviders(): Promise<void> {
        try {
            const response = await this.GetProviderMetadata();
            const providers = response.MetaData.map((meta) => meta.provider);
            await MemoryCache.setArray('providers', providers, this.cacheRefreshInterval);

            logger.info('Providers cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching providers metadata', { error: TruncateError(error) });
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
                const delegations = await this.getProviderDelegations(provider);
                for (const delegation of delegations) {
                    if (IsMeaningfulText(delegation.delegator)) {
                        uniqueDelegators.add(delegation.delegator);
                    }
                }
            }

            await MemoryCache.setArray('uniqueDelegators', Array.from(uniqueDelegators), this.cacheRefreshInterval);

            logger.info('UniqueDelegatorsCache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching and caching unique delegators', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheEmptyProviderDelegations(): Promise<void> {
        try {
            const emptyProviderDelegations = await this.GetProviderDelegators('empty_provider');
            await MemoryCache.set('empty_provider_delegations', emptyProviderDelegations.delegations, this.cacheRefreshInterval);
            logger.info('Empty provider delegations cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching empty provider delegations', { error: TruncateError(error) });
        }
    }

    public async GetTotalDelegatedAmount(from?: number, includeEmptyProviders: boolean = false): Promise<bigint> {
        const providers = await this.GetProviders();
        let totalAmount = BigInt(0);

        for (const provider of providers) {
            const delegations = await this.getProviderDelegations(provider);
            if (!delegations) {
                continue;
            }

            totalAmount += this.sumUlavaDelegations(delegations, from);
        }

        if (includeEmptyProviders) {
            const emptyProviderDelegations = await this.getProviderDelegations('empty_provider');
            if (emptyProviderDelegations) {
                totalAmount += this.sumUlavaDelegations(emptyProviderDelegations, from);
            } else {
                logger.warn('No empty provider delegations found in cache.');
            }
        }

        return totalAmount;
    }

    private sumUlavaDelegations(delegations: Delegation[], from?: number): bigint {
        return delegations.reduce((sum, delegation) => {
            if (from && Number(delegation.timestamp) < from) {
                return sum;
            }
            if (delegation.amount.denom.toLowerCase() != 'ulava') {
                return 0n;
            }
            return sum + BigInt(delegation.amount.amount);
        }, BigInt(0));
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

    public async GetProviderDelegators(provider: string): Promise<ProviderDelegatorsResponse> {
        const cacheKey = `provider_delegators_${provider}`;
        let delegators = await MemoryCache.get<ProviderDelegatorsResponse>(cacheKey);

        if (!delegators) {
            delegators = await QueryLavaRPC<ProviderDelegatorsResponse>(
                `/lavanet/lava/dualstaking/provider_delegators/${provider}`
            );
            await MemoryCache.set(cacheKey, delegators, this.cacheRefreshInterval);
        }

        return delegators;
    }

    public async GetProviderMetadata(): Promise<ProviderMetadataResponse> {
        const cacheKey = `provider_metadata`;
        let metadata = await MemoryCache.get<ProviderMetadataResponse>(cacheKey);

        if (!metadata) {
            metadata = await QueryLavaRPC<ProviderMetadataResponse>(`/lavanet/lava/epochstorage/provider_metadata/`);
            await MemoryCache.set(cacheKey, metadata, this.cacheRefreshInterval);
        }

        return metadata;
    }

    public async getProviderDelegations(provider: string): Promise<Delegation[]> {
        const cacheKey = `provider_delegations_${provider}`;
        let delegations = await MemoryCache.get<Delegation[]>(cacheKey);

        if (!delegations) {
            const delegatorsResponse = await this.GetProviderDelegators(provider);
            delegations = delegatorsResponse.delegations;
            await MemoryCache.set(cacheKey, delegations, this.cacheRefreshInterval);
        }

        return delegations;
    }

    public async GetUniqueDelegatorCount(from?: number, includeEmptyProviders: boolean = false): Promise<number> {
        const providers = await this.GetProviders();
        const uniqueDelegators = new Set<string>();

        for (const provider of providers) {
            const delegations = await this.getProviderDelegations(provider);
            if (!delegations) {
                continue;
            }

            for (const delegation of delegations) {
                if (from && Number(delegation.timestamp) < from) {
                    continue;
                }
                if (IsMeaningfulText(delegation.delegator)) {
                    uniqueDelegators.add(delegation.delegator);
                }
            }
        }

        if (includeEmptyProviders) {
            const emptyProviderDelegations = await this.getProviderDelegations('empty_provider');
            if (emptyProviderDelegations) {
                for (const delegation of emptyProviderDelegations) {
                    if (from && Number(delegation.timestamp) < from) {
                        continue;
                    }
                    if (IsMeaningfulText(delegation.delegator)) {
                        uniqueDelegators.add(delegation.delegator);
                    }
                }
            } else {
                logger.warn('No empty provider delegations found in cache.');
            }
        }

        return uniqueDelegators.size;
    }

    public async GetAllValidators(): Promise<string[]> {
        const validators = await MemoryCache.getArray<string>('all_validators');
        if (!validators) {
            await this.refreshCache();
            return await MemoryCache.getArray<string>('all_validators') || [];
        }
        return validators;
    }

    private async fetchAndCacheValidators(): Promise<void> {
        try {
            let validatorAddresses: string[] = [];
            let nextKey: string | null = null;

            do {
                const queryParams = nextKey ? `?pagination.key=${encodeURIComponent(nextKey)}` : '';
                const response = await QueryLavaRPC<AllValidatorsResponse>(`/cosmos/staking/v1beta1/validators${queryParams}`);

                validatorAddresses = validatorAddresses.concat(response.validators.map(validator => validator.operator_address));
                nextKey = response.pagination.next_key;
            } while (nextKey);

            await MemoryCache.setArray('all_validators', validatorAddresses, this.cacheRefreshInterval);
            logger.info(`Fetched and cached ${validatorAddresses.length} validators successfully.`);
        } catch (error) {
            logger.error('Error fetching validators', { error: TruncateError(error) });
        }
    }
}

export const RpcPeriodicEndpointCache = new RpcPeriodicEndpointCacheClass();
