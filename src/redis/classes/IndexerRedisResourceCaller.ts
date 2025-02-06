import { logger } from '@jsinfo/utils/logger';

// Ajax Resources
import { AprResource } from '../resources/ajax/AprResource';
import { AutoCompleteResource } from '../resources/ajax/AutoCompleteResource';
import { ChainWalletResource } from '../resources/ajax/ChainWalletResource';
import { SupplyResource } from '../resources/ajax/SupplyResource';
import { ListProvidersResource } from '../resources/ajax/ListProvidersResource';

// Global Resources
import { ProviderMonikerService } from '../resources/global/ProviderMonikerSpecResource';
import { SpecAndConsumerService } from '../resources/global/SpecAndConsumerResource';

// Index Resources
import { Index30DayCuResource } from '../resources/index/Index30DayCuResource';
import { IndexChartsResource } from '../resources/index/IndexChartsResource';
import { IndexLatestBlockResource } from '../resources/index/IndexLatestBlockResource';
import { IndexProvidersActiveResource } from '../resources/index/IndexProvidersActiveResource';
import { IndexProvidersResource } from '../resources/index/IndexProvidersResource';
import { ProviderStakesAndDelegationResource } from '../resources/global/ProviderStakesAndDelegationResource';
import { IndexTopChainsResource } from '../resources/index/IndexTopChainsResource';
import { IndexTotalCuResource } from '../resources/index/IndexTotalCuResource';
import { ActiveProvidersService } from '../resources/index/ActiveProvidersResource';
import { AllProviderAPRResource } from '../resources/ajax/AllProviderAprResource';
import { LockedTokenValuesResource } from '../resources/ajax/LockedTokenValuesResource';
import { LockedVestingTokensService } from '../resources/global/LockedVestingTokensResource';
import { IpRpcEndpointsIndexService } from '../resources/IpRpcEndpointsIndex/IpRpcEndpointsResource';
import { MainnetProviderEstimatedRewardsListService } from '../resources/MainnetProviderEstimatedRewards/MainnetProviderEstimatedRewardsListResource';
import { IsMainnet } from '@jsinfo/utils/env';
import { MainnetValidatorsWithRewardsService } from '../resources/MainetValidatorWithRewards/MainnetValidatorsWithRewardsResource';

export class IndexerRedisResourceCaller {
    private static readonly REFRESH_INTERVAL = 60 * 1000; // 1 minute
    private static isRunning = false;
    private static intervalId: any | null = null;

    static async startIndexing(): Promise<void> {
        logger.info('RedisIndexer:: Starting Redis resource indexer');

        try {
            // Always refresh immediately, regardless of previous state
            logger.info('RedisIndexer:: Performing initial refresh');
            await this.refreshAllResources().catch(error => {
                logger.error('RedisIndexer:: Initial refresh failed:', error);
            });

            // Clear any existing interval
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            // Set new interval
            this.isRunning = true;
            this.intervalId = setInterval(async () => {
                if (!this.isRunning) return;

                try {
                    await this.refreshAllResources();
                } catch (error) {
                    logger.error('RedisIndexer:: Interval refresh failed:', error);
                }
            }, this.REFRESH_INTERVAL);

            logger.info(`RedisIndexer:: Indexer started with ${this.REFRESH_INTERVAL}ms interval`);

        } catch (error) {
            logger.error('RedisIndexer:: Failed to start indexing:', error);

            // Ensure interval is set even if something fails
            if (!this.intervalId) {
                logger.info('RedisIndexer:: Setting up fallback interval');
                this.intervalId = setInterval(async () => {
                    if (!this.isRunning) return;

                    try {
                        await this.refreshAllResources();
                    } catch (error) {
                        logger.error('RedisIndexer:: Fallback interval refresh failed:', error);
                    }
                }, this.REFRESH_INTERVAL);
            }
        }
    }

    static stopIndexing(): void {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logger.info('RedisIndexer:: Stopping Redis resource indexer');
    }

    private static async refreshAllResources(): Promise<void> {
        const startTime = Date.now();
        logger.info('RedisIndexer:: Refreshing Redis resources');

        try {
            // These main groups still run in parallel for overall performance
            await Promise.all([
                this.refreshAjaxResources(),
                this.refreshIndexResources(),
                this.refreshGlobalResources(),
                this.refreshIpRpcEndpoints(),
                this.refreshMainnetOnlyResources()
            ]);

            const duration = Date.now() - startTime;
            logger.info(`RedisIndexer:: Completed Redis resources refresh in ${duration}ms`);
        } catch (error) {
            logger.error('RedisIndexer:: Failed to refresh Redis resources:', error);
        }
    }

    private static async safeFetch<T>(
        name: string,
        fetchFn: () => Promise<T>,
        currentFetches: Map<string, Promise<T>> = new Map()
    ): Promise<T> {
        if (currentFetches.has(name)) {
            logger.info(`${name} fetch already running, skipping`);
            return currentFetches.get(name)!;
        }

        const fetchPromise = (async () => {
            try {
                return await fetchFn();
            } finally {
                currentFetches.delete(name);
            }
        })();

        currentFetches.set(name, fetchPromise);
        return fetchPromise;
    }

    private static currentFetches = new Map<string, Promise<any>>();

    private static async refreshAjaxResources(): Promise<void> {
        await this.safeFetch('AllProviderAPR',
            () => new AllProviderAPRResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh all provider APR:', e));

        await this.safeFetch('TotalValueLocked',
            () => new LockedTokenValuesResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh total value locked:', e));

        await this.safeFetch('TotalSupply',
            () => new SupplyResource().fetch({ type: 'total' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh total supply:', e));

        await this.safeFetch('CirculatingSupply',
            () => new SupplyResource().fetch({ type: 'circulating' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh circulating supply:', e));

        await this.safeFetch('Stakers',
            () => new ChainWalletResource().fetch({ type: 'stakers' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh stakers:', e));

        await this.safeFetch('Restakers',
            () => new ChainWalletResource().fetch({ type: 'restakers' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh restakers:', e));

        await this.safeFetch('APR',
            () => new AprResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh APR data:', e));

        await this.safeFetch('AutoComplete',
            () => new AutoCompleteResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh autocomplete data:', e));

        await this.safeFetch('ListProviders',
            () => new ListProvidersResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh providers list:', e));
    }

    private static async refreshIndexResources(): Promise<void> {
        await this.safeFetch('ProviderStakesAndDelegation',
            () => new ProviderStakesAndDelegationResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index stakes:', e));

        await this.safeFetch('LatestBlock',
            () => new IndexLatestBlockResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh latest block:', e));

        await this.safeFetch('TotalCU',
            () => new IndexTotalCuResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index total CU:', e));

        await this.safeFetch('TopChains',
            () => new IndexTopChainsResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index top chains:', e));

        await this.safeFetch('Charts',
            () => new IndexChartsResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index charts:', e));

        await this.safeFetch('30DayCU',
            () => new Index30DayCuResource().fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index 30-day CU:', e));

        await this.refreshProviderIndexResources();
    }

    private static async refreshProviderIndexResources(): Promise<void> {
        await this.safeFetch('ActiveProviders',
            () => ActiveProvidersService.fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh active providers:', e));

        await this.safeFetch('ProvidersCount',
            () => new IndexProvidersResource().fetch({ type: 'count' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index providers (count):', e));

        await this.safeFetch('ProvidersPaginated',
            () => new IndexProvidersResource().fetch({ type: 'paginated' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh index providers (paginated):', e));

        await this.safeFetch('ActiveProvidersIndexCount',
            () => new IndexProvidersActiveResource().fetch({ type: 'count' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh active providers index (count):', e));

        await this.safeFetch('ActiveProvidersIndexPaginated',
            () => new IndexProvidersActiveResource().fetch({ type: 'paginated' }),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh active providers index (paginated):', e));
    }

    private static async refreshGlobalResources(): Promise<void> {
        await Promise.all([
            this.safeFetch('SpecAndConsumer',
                () => SpecAndConsumerService.fetch(),
                this.currentFetches
            ).catch(e => logger.error('Failed to refresh spec and consumer data:', e)),

            this.safeFetch('ProviderMoniker',
                () => ProviderMonikerService.fetch(),
                this.currentFetches
            ).catch(e => logger.error('Failed to refresh provider moniker spec data:', e)),

            this.safeFetch('LockedVestingTokens',
                () => LockedVestingTokensService.fetch(),
                this.currentFetches
            ).catch(e => logger.error('Failed to refresh locked vesting tokens:', e))
        ]);
    }

    private static async refreshIpRpcEndpoints(): Promise<void> {
        await this.safeFetch('IpRpcEndpoints',
            () => IpRpcEndpointsIndexService.fetch(),
            this.currentFetches
        ).catch(e => logger.error('Failed to refresh ip rpc endpoints:', e));
    }

    private static async refreshMainnetOnlyResources(): Promise<void> {
        if (IsMainnet()) {
            await this.safeFetch('MainnetProviderEstimatedRewards',
                () => MainnetProviderEstimatedRewardsListService.fetch(),
                this.currentFetches
            ).catch(e => logger.error('Failed to refresh mainnet provider estimated rewards:', e));
            await this.safeFetch('MainnetValidatorsAndRewards',
                () => MainnetValidatorsWithRewardsService.fetch(),
                this.currentFetches
            ).catch(e => logger.error('Failed to refresh mainnet validators and rewards:', e));
        }
    }
}

