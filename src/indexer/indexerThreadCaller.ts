// src/indexer/restrpc_agregators/RestRpcAgregatorsCaller.ts

import { logger } from '@jsinfo/utils/logger';

// Monitors
import { DelegatorRewardsMonitor } from "./restrpc_agregators/DelegatorRewardsMonitor";
import { SpecTrackedInfoMonitor } from "./restrpc_agregators/SpecTrackedInfoMonitor";

// Processors
import { ProcessSubscriptionList } from "./restrpc_agregators/SubscriptionListProcessor";
import { ProcessProviderMonikerSpecs } from "./restrpc_agregators/ProviderSpecMonikerProcessor";
import { ProcessChainWalletApi } from "./restrpc_agregators/ChainWalletApiProcessor";
import { ProcessChainSpecs } from "./restrpc_agregators/ChainSpecProcessor";

// Redis Resource Manager
import { AggConsumerRelayPayments } from '@jsinfo/indexer/agregators/consumerRelayPayments/aggConsumerRelayPayments';
import { AggProviderRelayPayments } from '@jsinfo/indexer/agregators/providerRelayPayments/aggProviderRelayPayments';
import { IndexerRedisResourceCaller } from "@jsinfo/redis/classes/IndexerRedisResourceCaller";

// Supply Processor
import { SyncBlockchainEntities } from './blockchainEntities/blockchainEntitiesSync';
import { FillUpBlocks } from '@jsinfo/indexer/indexerFillupBlocks';
import { JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS } from './indexerConsts';

export class IndexerThreadManagerClass {
    private isRunning = false;
    private runningProcesses = new Set<string>();
    private startTime: number | null = null;

    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('IndexerThreadManager:: is already running');
            return;
        }

        this.startTime = Date.now();
        this.isRunning = true;

        this.startBackgroundServices();

        while (true) {
            try {
                this.checkGracefulExit();
                await this.processAggregations();
                await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between iterations
            } catch (error) {
                logger.error('IndexerThreadManager:: Loop error:', error);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
            }
        }
    }

    private checkGracefulExit(): void {
        if (this.startTime &&
            Date.now() - this.startTime > JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS * 60 * 60 * 1000) {
            logger.info('IndexerThreadManager:: JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS has passed. Exiting process.');
            process.exit();
        }
    }

    private async startFillUpBlocksMonitor(): Promise<void> {
        while (true) {
            this.checkGracefulExit();
            try {
                await this.runWithLock('FillUpBlocks', async () => {
                    await FillUpBlocks();
                });
            } catch (error) {
                logger.error('IndexerThreadManager:: FillUpBlocks error:', error);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    private async startBackgroundServices(): Promise<void> {
        logger.info('IndexerThreadManager:: Starting background monitors');

        // Start all monitors in parallel
        await Promise.all([
            DelegatorRewardsMonitor.start(),
            SpecTrackedInfoMonitor.start(),
            IndexerRedisResourceCaller.startIndexing(),
            this.startFillUpBlocksMonitor(),
        ]);
    }

    private async runWithLock(name: string, fn: () => Promise<void>): Promise<void> {
        if (this.runningProcesses.has(name)) {
            return;
        }

        try {
            this.runningProcesses.add(name);
            await fn();
        } finally {
            this.runningProcesses.delete(name);
        }
    }

    private async processAggregations(): Promise<void> {
        const processors = [
            {
                name: 'SubscriptionList',
                process: () => ProcessSubscriptionList()
            },
            {
                name: 'ProviderMonikerSpecs',
                process: () => ProcessProviderMonikerSpecs()
            },
            {
                name: 'ChainWalletApi',
                process: () => ProcessChainWalletApi()
            },
            {
                name: 'ChainSpecs',
                process: () => ProcessChainSpecs()
            },
            {
                name: 'ProviderRelayPayments',
                process: () => AggProviderRelayPayments()
            },
            {
                name: 'ConsumerRelayPayments',
                process: () => AggConsumerRelayPayments()
            },
            {
                name: 'SyncBlockchainEntities',
                process: () => SyncBlockchainEntities()
            },
        ];

        // Run all processors in parallel
        await Promise.all(processors.map(async processor => {
            logger.info(`IndexerThreadManager:: ${processor.name} processing started at: ${new Date().toISOString()}`);
            try {
                const start = Date.now();
                await this.runWithLock(processor.name, processor.process);
                const executionTime = Date.now() - start;
                logger.info(`IndexerThreadManager:: Successfully executed ${processor.name}. Execution time: ${executionTime}ms`);
            } catch (error) {
                logger.error(`IndexerThreadManager:: Failed to execute ${processor.name}:`, error);
            }
        }));
    }
}

export const IndexerThreadManager = new IndexerThreadManagerClass();

export async function IndexerThreadCallerStart(): Promise<void> {
    await IndexerThreadManager.start();
}

