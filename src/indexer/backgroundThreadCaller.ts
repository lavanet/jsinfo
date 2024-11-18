// src/indexer/restrpc_agregators/RestRpcAgregatorsCaller.ts

import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from '@jsinfo/utils/logger';
import { LavaClient } from '@jsinfo/indexer/types';

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
import { IndexerRedisResourceCaller } from "@jsinfo/redis/classes/IndexerRedisResourceCaller";

// Supply Processor
import { SaveTokenSupplyToDB } from './lavarpc_agregators/SupplyProcessor';

export class BackgroundThreadManager {
    private static isRunning = false;

    public static async start(db: PostgresJsDatabase, lavajsClient: LavaClient): Promise<void> {
        if (this.isRunning) {
            logger.info('Background Thread Manager is already running');
            return;
        }

        this.isRunning = true;
        await this.runAggregators(db, lavajsClient);
    }

    private static async runAggregators(db: PostgresJsDatabase, lavajsClient: LavaClient): Promise<void> {
        try {
            await this.startBackgroundMonitors();
            await this.processAggregations(db);
            await this.processTokenSupply(db, lavajsClient);
        } catch (error) {
            logger.error('Failed to run aggregators:', error);
        } finally {
            this.isRunning = false;
        }
    }

    private static async startBackgroundMonitors(): Promise<void> {
        logger.info('Starting background monitors');

        // Only these monitors need lavajsClient
        APRMonitor.start();
        DelegatorRewardsMonitor.start();
        SpecTrackedInfoMonitor.start();

        // This doesn't need lavajsClient
        IndexerRedisResourceCaller.startIndexing();
    }

    private static async processAggregations(db: PostgresJsDatabase): Promise<void> {
        const processors = [
            {
                name: 'SubscriptionList',
                process: () => ProcessSubscriptionList(db)
            },
            {
                name: 'ProviderMonikerSpecs',
                process: () => ProcessProviderMonikerSpecs(db)
            },
            {
                name: 'ChainWalletApi',
                process: () => ProcessChainWalletApi(db)
            },
            {
                name: 'ChainSpecs',
                process: () => ProcessChainSpecs(db)
            }
        ];

        for (const processor of processors) {
            logger.info(`${processor.name} processing started at: ${new Date().toISOString()}`);
            try {
                const start = Date.now();
                await processor.process();
                const executionTime = Date.now() - start;
                logger.info(`Successfully executed ${processor.name}. Execution time: ${executionTime}ms`);
            } catch (error) {
                logger.error(`Failed to execute ${processor.name}:`, error);
                throw error;
            }
        }
    }

    private static async processTokenSupply(db: PostgresJsDatabase, lavajsClient: LavaClient): Promise<void> {
        try {
            logger.info('Starting token supply processing');
            const start = Date.now();

            await SaveTokenSupplyToDB(db, lavajsClient);

            const executionTime = Date.now() - start;
            logger.info(`Successfully processed token supply. Execution time: ${executionTime}ms`);
        } catch (error) {
            logger.error('Failed to process token supply:', error);
            throw error;
        }
    }
}

export async function BackgroundThreadCaller(db: PostgresJsDatabase, lavajsClient: LavaClient): Promise<void> {
    await BackgroundThreadManager.start(db, lavajsClient);
}

