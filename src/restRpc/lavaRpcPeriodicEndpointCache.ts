// src/indexer/classes/RpcEndpointCahce.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/lavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { TruncateError } from '@jsinfo/utils/fmt';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

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

interface ChainInfo {
    chainName: string;
    chainID: string;
    enabledApiInterfaces: string[];
    api_count: string;
}

interface ChainListResponse {
    chainInfoList: ChainInfo[];
}

const CACHE_VALIDITY_PERIOD = 600; // 10 minutes in seconds

class RpcPeriodicEndpointCacheClass {
    private cacheRefreshInterval = 20 * 60; // 20 minutes
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.cacheRefreshInterval * 1000);
    }

    private async refreshCache(): Promise<void> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this._refreshCache()
            .finally(() => {
                this.refreshPromise = null;
            });

        return this.refreshPromise;
    }

    private async _refreshCache(): Promise<void> {
        try {
            await this.fetchAndCacheProviders();
            await this.fetchAndCacheDelegators();
            await this.fetchAndCacheEmptyProviderDelegations();
            await this.fetchAndCacheValidators();
            await this.fetchAndCacheChainList();
        } catch (error) {
            logger.error('Error refreshing cache', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheProviders(): Promise<void> {
        try {
            const cacheKey = 'providers';
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for providers
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                logger.info('Providers cache is still valid. Skipping refresh.');
                return; // Skip refresh if TTL is more than 10 minutes
            }
            const response = await this.GetProviderMetadata();
            const providers = response.MetaData.map((meta) => meta.provider);
            await RedisCache.setArray(cacheKey, providers, this.cacheRefreshInterval);
            logger.info('Providers cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching providers metadata', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheDelegators(): Promise<void> {
        try {
            const cacheKey = 'uniqueDelegators';
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for uniqueDelegators
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                logger.info('UniqueDelegators cache is still valid. Skipping refresh.');
                return; // Skip refresh if TTL is more than 10 minutes
            }
            const cachedProviders = await RedisCache.getArray('providers') as string[];
            if (!cachedProviders) {
                logger.warn('No providers found in cache. Skipping delegator fetching.');
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
            await RedisCache.setArray(cacheKey, Array.from(uniqueDelegators), this.cacheRefreshInterval);
            logger.info('UniqueDelegatorsCache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching and caching unique delegators', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheEmptyProviderDelegations(): Promise<void> {
        try {
            const cacheKey = 'empty_provider_delegations';
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for empty_provider_delegations
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                logger.info('Empty provider delegations cache is still valid. Skipping refresh.');
                return; // Skip refresh if TTL is more than 10 minutes
            }
            const emptyProviderDelegations = await this.GetProviderDelegators('empty_provider') as ProviderDelegatorsResponse;
            await RedisCache.setDict(cacheKey, emptyProviderDelegations.delegations, this.cacheRefreshInterval);
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
        const delegators = await RedisCache.getArray('uniqueDelegators') as string[];
        if (!delegators) {
            await this.refreshCache();
            return await RedisCache.getArray('uniqueDelegators') as string[] || [];
        }
        return delegators;
    }

    public async GetProviders(): Promise<string[]> {
        const providers = await RedisCache.getArray('providers') as string[];
        if (!providers) {
            await this.refreshCache();
            return await RedisCache.getArray('providers') as string[] || [];
        }
        return providers;
    }

    public async GetProviderDelegators(provider: string): Promise<ProviderDelegatorsResponse> {
        const cacheKey = `provider_delegators_${provider}`;
        let delegators = await RedisCache.getDict(cacheKey) as ProviderDelegatorsResponse;

        if (!delegators) {
            delegators = await QueryLavaRPC<ProviderDelegatorsResponse>(
                `/lavanet/lava/dualstaking/provider_delegators/${provider}`
            );
            await RedisCache.setDict(cacheKey, delegators, this.cacheRefreshInterval);
        }

        return delegators;
    }

    public async GetProviderMetadata(): Promise<ProviderMetadataResponse> {
        const cacheKey = `provider_metadata`;
        let metadata = await RedisCache.getDict(cacheKey) as ProviderMetadataResponse;

        if (!metadata) {
            metadata = await QueryLavaRPC<ProviderMetadataResponse>(`/lavanet/lava/epochstorage/provider_metadata/`);
            await RedisCache.setDict(cacheKey, metadata, this.cacheRefreshInterval);
        }

        return metadata;
    }

    public async getProviderDelegations(provider: string): Promise<Delegation[]> {
        const cacheKey = `provider_delegations_${provider}`;
        let delegations = await RedisCache.getArray(cacheKey) as Delegation[];

        if (!delegations) {
            const delegatorsResponse = await this.GetProviderDelegators(provider);
            delegations = delegatorsResponse.delegations;
            await RedisCache.setArray(cacheKey, delegations, this.cacheRefreshInterval);
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
        const validators = await RedisCache.getArray('all_validators') as string[];
        if (!validators) {
            await this.refreshCache();
            return await RedisCache.getArray('all_validators') as string[] || [];
        }
        return validators;
    }

    private async fetchAndCacheValidators(): Promise<void> {
        try {
            const cacheKey = 'all_validators';
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for all_validators
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                logger.info('Validators cache is still valid. Skipping refresh.');
                return; // Skip refresh if TTL is more than 10 minutes
            }
            let validatorAddresses: string[] = [];
            let nextKey: string | null = null;
            do {
                const queryParams = nextKey ? `?pagination.key=${encodeURIComponent(nextKey)}` : '';
                const response: AllValidatorsResponse = await QueryLavaRPC<AllValidatorsResponse>(`/cosmos/staking/v1beta1/validators${queryParams}`);
                validatorAddresses = validatorAddresses.concat(response.validators.map(validator => validator.operator_address));
                nextKey = response.pagination.next_key;
            } while (nextKey);
            await RedisCache.setArray(cacheKey, validatorAddresses, this.cacheRefreshInterval);
            logger.info(`Fetched and cached ${validatorAddresses.length} validators successfully.`);
        } catch (error) {
            logger.error('Error fetching validators', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheChainList(): Promise<void> {
        try {
            const cacheKey = 'chain_list';
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for chain_list
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                logger.info('Chain list cache is still valid. Skipping refresh.');
                return; // Skip refresh if TTL is more than 10 minutes
            }
            const response: ChainListResponse = await QueryLavaRPC<ChainListResponse>('/lavanet/lava/spec/show_all_chains');
            await RedisCache.setArray(cacheKey, response.chainInfoList, this.cacheRefreshInterval);
            logger.info('Chain list cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching chain list', { error: TruncateError(error) });
        }
    }

    public async GetChainList(): Promise<ChainInfo[]> {
        const chainList = await RedisCache.getArray('chain_list') as ChainInfo[];
        if (!chainList) {
            await this.refreshCache();
            return await RedisCache.getArray('chain_list') as ChainInfo[] || [];
        }
        return chainList;
    }
}

export const RpcPeriodicEndpointCache = new RpcPeriodicEndpointCacheClass();
