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
import { IndexStakesResource } from '../resources/index/IndexStakesResource';
import { IndexTopChainsResource } from '../resources/index/IndexTopChainsResource';
import { IndexTotalCuResource } from '../resources/index/IndexTotalCuResource';
import { ActiveProvidersResource } from '../resources/index/ActiveProvidersResource';
import { AllProviderAPRResource } from '../resources/ajax/AllProviderAprResource';
import { TotalValueLockedResource } from '../resources/ajax/TotalValueLockedResource';
import { LockedVestingTokensService } from '../resources/global/LockedVestingTokensResource';

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
                this.refreshGlobalResources()
            ]);

            const duration = Date.now() - startTime;
            logger.info(`RedisIndexer:: Completed Redis resources refresh in ${duration}ms`);
        } catch (error) {
            logger.error('RedisIndexer:: Failed to refresh Redis resources:', error);
        }
    }

    private static async refreshAjaxResources(): Promise<void> {
        // AllProviderAPRResource
        await new AllProviderAPRResource().fetch()
            .catch(e => logger.error('Failed to refresh all provider APR:', e));
        // Total Value Locked
        await new TotalValueLockedResource().fetch()
            .catch(e => logger.error('Failed to refresh total value locked:', e));

        // Supply Resources
        await new SupplyResource().fetch({ type: 'total' })
            .catch(e => logger.error('Failed to refresh total supply:', e));
        await new SupplyResource().fetch({ type: 'circulating' })
            .catch(e => logger.error('Failed to refresh circulating supply:', e));

        // Chain Wallet Resources
        await new ChainWalletResource().fetch({ type: 'stakers' })
            .catch(e => logger.error('Failed to refresh stakers:', e));
        await new ChainWalletResource().fetch({ type: 'restakers' })
            .catch(e => logger.error('Failed to refresh restakers:', e));

        // Other Ajax Resources
        await new AprResource().fetch()
            .catch(e => logger.error('Failed to refresh APR data:', e));
        await new AutoCompleteResource().fetch()
            .catch(e => logger.error('Failed to refresh autocomplete data:', e));
        await new ListProvidersResource().fetch()
            .catch(e => logger.error('Failed to refresh providers list:', e));



    }

    private static async refreshIndexResources(): Promise<void> {
        // Basic Index Resources
        await new IndexStakesResource().fetch()
            .catch(e => logger.error('Failed to refresh index stakes:', e));
        await new IndexLatestBlockResource().fetch()
            .catch(e => logger.error('Failed to refresh latest block:', e));
        await new IndexTotalCuResource().fetch()
            .catch(e => logger.error('Failed to refresh index total CU:', e));
        await new IndexTopChainsResource().fetch()
            .catch(e => logger.error('Failed to refresh index top chains:', e));
        await new IndexChartsResource().fetch()
            .catch(e => logger.error('Failed to refresh index charts:', e));
        await new Index30DayCuResource().fetch()
            .catch(e => logger.error('Failed to refresh index 30-day CU:', e));

        // Provider-related Index Resources
        await this.refreshProviderIndexResources();
    }

    private static async refreshProviderIndexResources(): Promise<void> {
        // Active Providers
        await new ActiveProvidersResource().fetch()
            .catch(e => logger.error('Failed to refresh active providers:', e));

        // Index Providers
        await new IndexProvidersResource().fetch({ type: 'count' })
            .catch(e => logger.error('Failed to refresh index providers (count):', e));
        await new IndexProvidersResource().fetch({ type: 'paginated' })
            .catch(e => logger.error('Failed to refresh index providers (paginated):', e));

        // Index Providers Active
        await new IndexProvidersActiveResource().fetch({ type: 'count' })
            .catch(e => logger.error('Failed to refresh active providers index (count):', e));
        await new IndexProvidersActiveResource().fetch({ type: 'paginated' })
            .catch(e => logger.error('Failed to refresh active providers index (paginated):', e));
    }

    private static async refreshGlobalResources(): Promise<void> {
        await SpecAndConsumerService.fetch()
            .catch(e => logger.error('Failed to refresh spec and consumer data:', e));
        await ProviderMonikerService.fetch()
            .catch(e => logger.error('Failed to refresh provider moniker spec data:', e));
        await LockedVestingTokensService.fetch()
            .catch(e => logger.error('Failed to refresh locked vesting tokens:', e));
    }
}

