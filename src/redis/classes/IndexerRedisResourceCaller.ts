import { SupplyResource } from '@jsinfo/redis/resources/ajax/SupplyResource';
import { ChainWalletResource } from '@jsinfo/redis/resources/ajax/ChainWalletResource';
import { logger } from '@jsinfo/utils/logger';
import { GetJsinfoDbForIndexer } from '@jsinfo/utils/db';
import { AprResource } from '../resources/ajax/AprResource';
import { AutoCompleteResource } from '../resources/ajax/AutoCompleteResource';
import { SpecAndConsumerService } from '../resources/global/SpecAndConsumerResource';
import { ProviderMonikerService } from '../resources/global/ProviderMonikerSpecResource';

export class IndexerRedisResourceCaller {
    private static readonly REFRESH_INTERVAL = 60 * 1000; // 1 minute
    private static isRunning = false;

    static startIndexing(): void {
        if (this.isRunning) {
            logger.warn('Indexer is already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting Redis resource indexer');

        // Start the indexing loop in the background
        this.runIndexingLoop();
    }

    static stopIndexing(): void {
        this.isRunning = false;
        logger.info('Stopping Redis resource indexer');
    }

    private static async runIndexingLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                await this.refreshAllResources();
                await new Promise(resolve => setTimeout(resolve, this.REFRESH_INTERVAL));
            } catch (error) {
                logger.error('Error in Redis indexer:', error);
            }
        }
    }

    private static async refreshAllResources(): Promise<void> {
        const startTime = Date.now();
        logger.info('Refreshing Redis resources');

        const db = await GetJsinfoDbForIndexer();
        try {
            // Supply resources
            const supplyResource = new SupplyResource();
            await Promise.all([
                supplyResource.fetch(db, { type: 'total' })
                    .catch(e => logger.error('Failed to refresh total supply:', e)),
                supplyResource.fetch(db, { type: 'circulating' })
                    .catch(e => logger.error('Failed to refresh circulating supply:', e)),
            ]);

            // Chain wallet resources
            const chainWalletResource = new ChainWalletResource();
            await Promise.all([
                chainWalletResource.fetch(db, { type: 'stakers' })
                    .catch(e => logger.error('Failed to refresh stakers:', e)),
                chainWalletResource.fetch(db, { type: 'restakers' })
                    .catch(e => logger.error('Failed to refresh restakers:', e)),
            ]);

            // APR resource
            const aprResource = new AprResource();
            await aprResource.fetch(db)
                .catch(e => logger.error('Failed to refresh APR data:', e));

            // Auto complete resource
            const autoCompleteResource = new AutoCompleteResource();
            await autoCompleteResource.fetch(db)
                .catch(e => logger.error('Failed to refresh autocomplete data:', e));

            // Spec and consumer resource       
            await SpecAndConsumerService.fetch(db)
                .catch(e => logger.error('Failed to refresh spec and consumer data:', e));

            // Provider moniker spec resource
            await ProviderMonikerService.fetch(db)
                .catch(e => logger.error('Failed to refresh provider moniker spec data:', e));

            const duration = Date.now() - startTime;
            logger.info(`Completed Redis resources refresh in ${duration}ms`);
        } catch (error) {
            logger.error('Failed to refresh Redis resources:', error);
        }
    }
}

