// src/indexer/classes/RpcEndpointCahce.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/lavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { TruncateError } from '@jsinfo/utils/fmt';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import * as fs from 'fs';
import * as path from 'path';

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
            logger.info('Starting cache refresh...');
            const startTime = Date.now();

            const promises = [
                this.fetchAndCacheProviders(),
                this.fetchAndCacheDelegators(),
                this.fetchAndCacheEmptyProviderDelegations(),
                this.fetchAndCacheValidators(),
                this.fetchAndCacheChainList()
            ];

            await Promise.all(promises);

            const duration = Date.now() - startTime;
            logger.info(`Cache refresh completed in ${duration}ms`);
        } catch (error) {
            logger.error('Error refreshing cache', {
                error: TruncateError(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }

    private async fetchAndCacheProviders(): Promise<void> {
        try {
            const startTime = Date.now();
            logger.info('Fetching providers metadata...');

            const cacheKey = REDIS_KEYS.PROVIDERS;
            const ttl = await RedisCache.getTTL(cacheKey);

            if (ttl && ttl > CACHE_VALIDITY_PERIOD) {
                logger.info(`Skipping providers refresh - TTL: ${ttl}s`);
                return;
            }

            const response = await this.GetProviderMetadata();
            const providers = response.MetaData.map((meta) => meta.provider);
            await RedisCache.setArray(cacheKey, providers, this.cacheRefreshInterval);

            const duration = Date.now() - startTime;
            logger.info(`Providers cache refreshed: ${providers.length} providers in ${duration}ms`);
        } catch (error) {
            logger.error('Error fetching providers metadata', {
                error: TruncateError(error),
                stack: error instanceof Error ? error.stack : undefined
            });
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
        const delegators = await RedisCache.getArray(REDIS_KEYS.UNIQUE_DELEGATORS) as string[];
        if (!delegators) {
            await this.refreshCache();
            return await RedisCache.getArray(REDIS_KEYS.UNIQUE_DELEGATORS) as string[] || [];
        }
        return delegators;
    }

    public async GetProviders(): Promise<string[]> {
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
        const startTime = Date.now();
        const summary: any = {
            args: {
                from: from ? new Date(from * 1000).toISOString() : 'none',
                includeEmptyProviders
            },
            providers: {
                total: 0,
                processed: 0,
                withDelegations: 0
            },
            delegators: {
                total: 0,
                byProvider: {},
                timestamps: {
                    first: null,
                    last: null,
                    range: null
                }
            },
            timing: {
                start: new Date().toISOString(),
                durationMs: 0
            }
        };

        const providers = await this.GetProviders();
        summary.providers.total = providers.length;

        const uniqueDelegators = new Set<string>();
        let firstTimestamp: number | null = null;
        let lastTimestamp: number | null = null;

        for (const provider of providers) {
            const delegations = await this.getProviderDelegations(provider);
            summary.providers.processed++;

            if (!delegations) {
                continue;
            }

            summary.providers.withDelegations++;
            const initialSize = uniqueDelegators.size;

            summary.delegators.byProvider[provider] = {
                count: uniqueDelegators.size - initialSize,
                timestamps: {
                    first: null,
                    last: null,
                    count: 0,
                    all: []  // Array to store all timestamps
                }
            };

            for (const delegation of delegations) {
                const timestamp = Number(delegation.timestamp);
                if (from && timestamp < from) {
                    continue;
                }
                if (IsMeaningfulText(delegation.delegator)) {
                    uniqueDelegators.add(delegation.delegator);

                    // Track timestamps for this provider
                    if (timestamp) {
                        summary.delegators.byProvider[provider].timestamps.count++;
                        summary.delegators.byProvider[provider].timestamps.all.push({
                            timestamp: new Date(timestamp * 1000).toISOString(),
                            delegator: delegation.delegator,
                            amount: delegation.amount,
                            provider: delegation.provider,
                            chainID: delegation.chainID,
                        });

                        if (!summary.delegators.byProvider[provider].timestamps.first ||
                            timestamp < Number(summary.delegators.byProvider[provider].timestamps.first)) {
                            summary.delegators.byProvider[provider].timestamps.first = new Date(timestamp * 1000).toISOString();
                        }
                        if (!summary.delegators.byProvider[provider].timestamps.last ||
                            timestamp > Number(summary.delegators.byProvider[provider].timestamps.last)) {
                            summary.delegators.byProvider[provider].timestamps.last = new Date(timestamp * 1000).toISOString();
                        }
                    }

                    // Track global timestamps
                    if (!firstTimestamp || timestamp < firstTimestamp) {
                        firstTimestamp = timestamp;
                    }
                    if (!lastTimestamp || timestamp > lastTimestamp) {
                        lastTimestamp = timestamp;
                    }
                }
            }
        }

        // Process empty providers with timestamp tracking
        if (includeEmptyProviders) {
            const emptyProviderDelegations = await this.getProviderDelegations('empty_provider');
            if (emptyProviderDelegations) {
                const initialSize = uniqueDelegators.size;

                summary.delegators.byProvider['empty_provider'] = {
                    count: uniqueDelegators.size - initialSize,
                    timestamps: {
                        first: null,
                        last: null,
                        count: 0,
                        all: []  // Array to store all timestamps
                    }
                };

                for (const delegation of emptyProviderDelegations) {
                    const timestamp = Number(delegation.timestamp);
                    if (from && timestamp < from) {
                        continue;
                    }
                    if (IsMeaningfulText(delegation.delegator)) {
                        uniqueDelegators.add(delegation.delegator);

                        // Track timestamps for empty providers
                        if (timestamp) {
                            summary.delegators.byProvider['empty_provider'].timestamps.count++;
                            summary.delegators.byProvider['empty_provider'].timestamps.all.push({
                                timestamp: new Date(timestamp * 1000).toISOString(),
                                delegator: delegation.delegator,
                                amount: delegation.amount,
                                provider: delegation.provider,
                                chainID: delegation.chainID,
                            });

                            if (!summary.delegators.byProvider['empty_provider'].timestamps.first ||
                                timestamp < Number(summary.delegators.byProvider['empty_provider'].timestamps.first)) {
                                summary.delegators.byProvider['empty_provider'].timestamps.first = new Date(timestamp * 1000).toISOString();
                            }
                            if (!summary.delegators.byProvider['empty_provider'].timestamps.last ||
                                timestamp > Number(summary.delegators.byProvider['empty_provider'].timestamps.last)) {
                                summary.delegators.byProvider['empty_provider'].timestamps.last = new Date(timestamp * 1000).toISOString();
                            }
                        }

                        // Track global timestamps
                        if (!firstTimestamp || timestamp < firstTimestamp) {
                            firstTimestamp = timestamp;
                        }
                        if (!lastTimestamp || timestamp > lastTimestamp) {
                            lastTimestamp = timestamp;
                        }
                    }
                }
            }
        }

        // Add timestamp information to summary
        if (firstTimestamp && lastTimestamp) {
            summary.delegators.timestamps = {
                first: new Date(firstTimestamp * 1000).toISOString(),
                last: new Date(lastTimestamp * 1000).toISOString(),
                range: `${((lastTimestamp - firstTimestamp) / (24 * 60 * 60)).toFixed(2)} days`
            };
        }

        summary.delegators.total = uniqueDelegators.size;
        summary.timing.durationMs = Date.now() - startTime;

        // Log summary
        logger.info('!! GetUniqueDelegatorCount Summary', {
            ...summary,
            timestamp: new Date().toISOString()
        });

        // Save to file
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const delegatorType = includeEmptyProviders ? 'stakers' : 'restakers';
            const filename = `mainnet_delegator_count_${delegatorType}_${timestamp}.json`;
            const filepath = path.join(process.cwd(), 'logs', filename);

            // Ensure logs directory exists
            if (!fs.existsSync(path.join(process.cwd(), 'logs'))) {
                fs.mkdirSync(path.join(process.cwd(), 'logs'));
            }

            // Add delegator type to summary
            summary.type = delegatorType;

            fs.writeFileSync(
                filepath,
                JSON.stringify(summary, null, 2),
                'utf8'
            );
            logger.info(`${delegatorType.charAt(0).toUpperCase() + delegatorType.slice(1)} summary saved to ${filepath}`);
        } catch (error) {
            logger.error('Failed to save summary to file', {
                error: TruncateError(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }

        return uniqueDelegators.size;
    }

    public async GetAllValidatorsAddresses(): Promise<string[]> {
        return (await this.GetAllValidators()).map(v => v.operator_address);
    }

    private async getValidatorsFromJson(validatorsJson: string | null): Promise<AllValidatorsResponse['validators']> {
        if (!validatorsJson) return [];
        try {
            const validators = JSON.parse(validatorsJson) as AllValidatorsResponse['validators'];
            // Basic validation check - ensure it's an array and has expected properties
            if (!Array.isArray(validators) || !validators[0]?.operator_address) {
                throw new Error('Invalid validator data structure');
            }
            return validators;
        } catch (error) {
            logger.warn('Failed to parse cached validators, fetching directly', { error: TruncateError(error) });
            await this.fetchAndCacheValidators();
            const freshValidatorsJson = await RedisCache.get(REDIS_KEYS.ALL_VALIDATORS);
            return freshValidatorsJson ? JSON.parse(freshValidatorsJson) : [];
        }
    }

    public async GetAllValidators(): Promise<AllValidatorsResponse['validators']> {
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