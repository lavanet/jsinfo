import { ProcessSubscriptionList } from "./SubscriptionList";
import { ProcessProviderMonikerSpecs } from "./ProviderSpecMoniker";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from "../../utils/utils";
import { ProcessDualStackingDelegatorRewards } from "./DualStakingDelegatorRewards";
import { ProcessAPR } from "./apr/Apr";

let isRunning = false;

export async function RestRpcAgreagorsCaller(db: PostgresJsDatabase): Promise<void> {
    if (isRunning) {
        logger.info('RestRpcAgreagorsCaller is already running. Exiting this call.');
        return;
    }

    isRunning = true;


    logger.info(`ProcessAPR started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessAPR(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessAPR. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessAPR. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }



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

    logger.info(`ProcessDualStackingDelegatorRewards started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessDualStackingDelegatorRewards(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessDualStackingDelegatorRewards. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessDualStackingDelegatorRewards. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }



    isRunning = false;
}

