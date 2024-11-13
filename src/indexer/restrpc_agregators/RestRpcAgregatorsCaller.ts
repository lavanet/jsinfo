// src/indexer/restrpc_agregators/RestRpcAgreagorsCaller.ts

import { ProcessSubscriptionList } from "./SubscriptionListProcessor";
import { ProcessProviderMonikerSpecs } from "./ProviderSpecMonikerProcessor";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from "../../utils/utils";
import { ProcessChainWalletApi } from "./ChainWalletApiProcessor";
import { APRMonitor } from "./AprMonitor";
import { DelegatorRewardsMonitor } from "./DelegatorRewardsMonitor";
import { SpecTrackedInfoMonitor } from "./SpecTrackedInfoMonitor";
import { ProcessChainSpecs } from "./ChainSpecProcessor";

let isRunning = false;

export async function RestRpcAgreagorsCaller(db: PostgresJsDatabase): Promise<void> {
    if (isRunning) {
        logger.info('RestRpcAgreagorsCaller is already running. Exiting this call.');
        return;
    }

    isRunning = true;

    // these guys run in the background
    APRMonitor.start();
    DelegatorRewardsMonitor.start();
    SpecTrackedInfoMonitor.start();

    logger.info(`ProcessSubscriptionList started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessSubscriptionList(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessSubscriptionList. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessSubscriptionList. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`ProcessProviderMonikerSpecs started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessProviderMonikerSpecs(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessProviderMonikerSpecs. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessProviderMonikerSpecs. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`ProcessChainWalletApi started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessChainWalletApi(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessChainWalletApi. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessChainWalletApi. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`ProcessChainSpecs started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessChainSpecs(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessChainSpecs. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessChainSpecs. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    isRunning = false;
}

