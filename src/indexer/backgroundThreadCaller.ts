// src/indexer/restrpc_agregators/RestRpcAgregatorsCaller.ts

import { logger } from '@jsinfo/utils/logger';

// Monitors
import { APRMonitor } from "./restrpc_agregators/AprMonitor";
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
import { SaveTokenSupplyToDB } from './lavarpc_agregators/SupplyProcessor';

export class BackgroundThreadManager {
    private static isRunning = false;
    private static runningProcesses = new Set<string>();

    public static async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('BackgroundThreadManager:: is already running');
            return;
        }

        this.isRunning = true;
        await this.runAggregators();
    }

    private static async runAggregators(): Promise<void> {
        try {
            await Promise.all([
                this.startBackgroundMonitors(),
                this.processAggregations(),
                this.processTokenSupply()
            ]);
        } catch (error) {
            logger.error('BackgroundThreadManager:: Failed to run aggregators:', error);
        } finally {
            this.isRunning = false;
        }
    }

    private static async startBackgroundMonitors(): Promise<void> {
        logger.info('BackgroundThreadManager:: Starting background monitors');

        // Start all monitors in parallel
        await Promise.all([
            APRMonitor.start(),
            DelegatorRewardsMonitor.start(),
            SpecTrackedInfoMonitor.start(),
            IndexerRedisResourceCaller.startIndexing()
        ]);
    }

    private static async runWithLock(name: string, fn: () => Promise<void>): Promise<void> {
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

    private static async processAggregations(): Promise<void> {
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
            }
        ];

        // Run all processors in parallel
        await Promise.all(processors.map(async processor => {
            logger.info(`BackgroundThreadManager:: ${processor.name} processing started at: ${new Date().toISOString()}`);
            try {
                const start = Date.now();
                await this.runWithLock(processor.name, processor.process);
                const executionTime = Date.now() - start;
                logger.info(`BackgroundThreadManager:: Successfully executed ${processor.name}. Execution time: ${executionTime}ms`);
            } catch (error) {
                logger.error(`BackgroundThreadManager:: Failed to execute ${processor.name}:`, error);
            }
        }));
    }

    private static async processTokenSupply(): Promise<void> {
        try {
            logger.info('BackgroundThreadManager:: Starting token supply processing');
            const start = Date.now();

            await SaveTokenSupplyToDB();

            const executionTime = Date.now() - start;
            logger.info(`BackgroundThreadManager:: Successfully processed token supply. Execution time: ${executionTime}ms`);
        } catch (error) {
            logger.error('BackgroundThreadManager:: Failed to process token supply:', error);
            throw error;
        }
    }
}

export async function BackgroundThreadCaller(): Promise<void> {
    await BackgroundThreadManager.start();
}

