// src/indexer/classes/RpcEndpointCahce.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/LavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { TruncateError } from '@jsinfo/utils/fmt';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';

const REDIS_KEYS = {
    PROVIDERS: 'providers',
    UNIQUE_DELEGATORS: 'uniqueDelegators',
    EMPTY_PROVIDER_DELEGATIONS: 'empty_provider_delegations',
    PROVIDER_METADATA: 'provider_metadata',
    PROVIDER_DELEGATORS_PREFIX: 'provider_delegators_',
    PROVIDER_DELEGATIONS_PREFIX: 'provider_delegations_',
    ALL_VALIDATORS: 'all_validators',
    CHAIN_LIST: 'chain_list'
} as const;

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

type ValidatorStatus =
    | 'BOND_STATUS_BONDED'
    | 'BOND_STATUS_UNBONDING'
    | 'BOND_STATUS_UNBONDED'
    | 'BOND_STATUS_UNSPECIFIED';

type ValidatorStatusDisplay =
    | 'Active'
    | 'Leaving'
    | 'Inactive'
    | 'Unknown';

export type Validator = {
    operator_address: string;
    consensus_pubkey: {
        "@type": string;
        [key: string]: string;
    };
    jailed: boolean;
    status: ValidatorStatus;
    displayStatus: ValidatorStatusDisplay;
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
};

interface AllValidatorsResponse {
    validators: Validator[];
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

    private readonly VALIDATOR_STATUS_MAP: Record<ValidatorStatus, ValidatorStatusDisplay> = {
        'BOND_STATUS_BONDED': 'Active',
        'BOND_STATUS_UNBONDING': 'Leaving',
        'BOND_STATUS_UNBONDED': 'Inactive',
        'BOND_STATUS_UNSPECIFIED': 'Unknown'
    } as const;

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
            const promises = [
                this.fetchAndCacheProviders(),
                this.fetchAndCacheDelegators(),
                this.fetchAndCacheEmptyProviderDelegations(),
                this.fetchAndCacheValidators(),
                this.fetchAndCacheChainList()
            ];
            await Promise.all(promises);
        } catch (error) {
            logger.error('Error refreshing cache', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheProviders(): Promise<void> {
        try {
            const cacheKey = REDIS_KEYS.PROVIDERS;
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for providers
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                return;
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
            const cacheKey = REDIS_KEYS.UNIQUE_DELEGATORS;
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for uniqueDelegators
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                return;
            }
            const cachedProviders = await RedisCache.getArray(REDIS_KEYS.PROVIDERS) as string[];
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

    public async GetEmptyProviderDelegations(): Promise<Delegation[]> {
        const delegations = await RedisCache.getDict(REDIS_KEYS.EMPTY_PROVIDER_DELEGATIONS) as Delegation[];
        if (!delegations) {
            await this.refreshCache();
            return await RedisCache.getDict(REDIS_KEYS.EMPTY_PROVIDER_DELEGATIONS) as Delegation[] || [];
        }
        return delegations;
    }

    private async fetchAndCacheEmptyProviderDelegations(): Promise<void> {
        try {
            const cacheKey = REDIS_KEYS.EMPTY_PROVIDER_DELEGATIONS;
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for empty_provider_delegations
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                return;
            }
            const emptyProviderDelegations = await this.GetProviderDelegators('empty_provider') as ProviderDelegatorsResponse;
            await RedisCache.setDict(cacheKey, emptyProviderDelegations.delegations, this.cacheRefreshInterval);
            logger.info('Empty provider delegations cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching empty provider delegations', { error: TruncateError(error) });
        }
    }

    public async GetTotalDelegatedAmount(from?: number, includeEmptyProviders: boolean = false): Promise<bigint> {
        const providers = await this.GetAllProvidersFromRpc();
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
        const delegators = await RedisCache.getArray(REDIS_KEYS.UNIQUE_DELEGATORS) as string[];
        if (!delegators) {
            await this.refreshCache();
            return await RedisCache.getArray(REDIS_KEYS.UNIQUE_DELEGATORS) as string[] || [];
        }
        return delegators;
    }

    public async GetAllProvidersFromRpc(): Promise<string[]> {
        const providers = await RedisCache.getArray(REDIS_KEYS.PROVIDERS) as string[];
        if (!providers) {
            await this.refreshCache();
            return await RedisCache.getArray(REDIS_KEYS.PROVIDERS) as string[] || [];
        }
        return providers;
    }

    public async GetProviderDelegators(provider: string): Promise<ProviderDelegatorsResponse> {
        const cacheKey = `${REDIS_KEYS.PROVIDER_DELEGATORS_PREFIX}${provider}`;
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
        const cacheKey = REDIS_KEYS.PROVIDER_METADATA;
        let metadata = await RedisCache.getDict(cacheKey) as ProviderMetadataResponse;

        if (!metadata) {
            metadata = await QueryLavaRPC<ProviderMetadataResponse>(`/lavanet/lava/epochstorage/provider_metadata/`);
            await RedisCache.setDict(cacheKey, metadata, this.cacheRefreshInterval);
        }

        return metadata;
    }

    public async getProviderDelegations(provider: string): Promise<Delegation[]> {
        const cacheKey = `${REDIS_KEYS.PROVIDER_DELEGATIONS_PREFIX}${provider}`;
        let delegations = await RedisCache.getArray(cacheKey) as Delegation[];

        if (!delegations) {
            const delegatorsResponse = await this.GetProviderDelegators(provider);
            delegations = delegatorsResponse.delegations;
            await RedisCache.setArray(cacheKey, delegations, this.cacheRefreshInterval);
        }

        return delegations;
    }

    public async GetUniqueDelegatorCount(from?: number, includeEmptyProviders: boolean = false): Promise<number> {
        const providers = await ActiveProvidersService.fetch();
        const uniqueDelegators = new Set<string>();

        if (!providers) {
            return 0;
        }

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

    public async GetAllValidatorsAddresses(): Promise<string[]> {
        return (await this.GetAllValidators()).map(v => v.operator_address);
    }

    public async GetAllActiveValidators(): Promise<Validator[]> {
        const allValidators = await this.GetAllValidators();
        return allValidators.filter(v => v.status === 'BOND_STATUS_BONDED');
    }

    public async GetAllActiveValidatorsAddresses(): Promise<string[]> {
        const allActiveValidators = await this.GetAllActiveValidators();
        return allActiveValidators.map(v => v.operator_address);
    }

    private async getValidatorsFromJson(validatorsJson: string | null): Promise<Validator[]> {
        if (!validatorsJson) return [];
        try {
            const validators = JSON.parse(validatorsJson) as Validator[];
            // Basic validation check
            if (!Array.isArray(validators) || !validators[0]?.operator_address) {
                throw new Error('Invalid validator data structure');
            }

            // Add displayStatus to each validator
            return validators.map(v => ({
                ...v,
                displayStatus: this.VALIDATOR_STATUS_MAP[v.status]
            }));
        } catch (error) {
            logger.warn('Failed to parse cached validators, fetching directly', { error: TruncateError(error) });
            await this.fetchAndCacheValidators();
            const freshValidatorsJson = await RedisCache.get(REDIS_KEYS.ALL_VALIDATORS);
            return freshValidatorsJson ? JSON.parse(freshValidatorsJson) : [];
        }
    }

    public async GetAllValidators(): Promise<Validator[]> {
        const validatorsJson = await RedisCache.get(REDIS_KEYS.ALL_VALIDATORS);
        if (!validatorsJson) {
            await this.refreshCache();
            const newValidatorsJson = await RedisCache.get(REDIS_KEYS.ALL_VALIDATORS);
            return this.getValidatorsFromJson(newValidatorsJson);
        }
        return this.getValidatorsFromJson(validatorsJson);
    }

    private async fetchAndCacheValidators(): Promise<void> {
        try {
            const cacheKey = REDIS_KEYS.ALL_VALIDATORS;
            const ttl = await RedisCache.getTTL(cacheKey);
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                return;
            }

            let validators: AllValidatorsResponse['validators'] = [];
            let nextKey: string | null = null;

            do {
                const queryParams = nextKey ? `?pagination.key=${encodeURIComponent(nextKey)}` : '';
                const response: AllValidatorsResponse = await QueryLavaRPC<AllValidatorsResponse>(`/cosmos/staking/v1beta1/validators${queryParams}`);
                validators = validators.concat(response.validators);
                nextKey = response.pagination.next_key;
            } while (nextKey);

            await RedisCache.set(cacheKey, JSON.stringify(validators), this.cacheRefreshInterval);
            logger.info(`Fetched and cached ${validators.length} validators successfully.`);
        } catch (error) {
            logger.error('Error fetching validators', { error: TruncateError(error) });
        }
    }

    private async fetchAndCacheChainList(): Promise<void> {
        try {
            const cacheKey = REDIS_KEYS.CHAIN_LIST;
            const ttl = await RedisCache.getTTL(cacheKey); // Get TTL for chain_list
            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                return;
            }
            const response: ChainListResponse = await QueryLavaRPC<ChainListResponse>('/lavanet/lava/spec/show_all_chains');
            await RedisCache.setArray(cacheKey, response.chainInfoList, this.cacheRefreshInterval);
            logger.info('Chain list cache refreshed successfully.');
        } catch (error) {
            logger.error('Error fetching chain list', { error: TruncateError(error) });
        }
    }

    public async GetChainList(): Promise<ChainInfo[]> {
        const chainList = await RedisCache.getArray(REDIS_KEYS.CHAIN_LIST) as ChainInfo[];
        if (!chainList) {
            await this.refreshCache();
            return await RedisCache.getArray(REDIS_KEYS.CHAIN_LIST) as ChainInfo[] || [];
        }
        return chainList;
    }
}

export const RpcPeriodicEndpointCache = new RpcPeriodicEndpointCacheClass();