// src/indexer/agregators/aggProviderRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger } from "../../../utils";
import { aggProviderHourlyRelayPayments } from "./aggProviderHourlyRelayPayments";
import { aggProviderDailyRelayPayments } from "./aggProviderDailyRelayPayments";
import { aggProviderAllTimeRelayPayments } from "./aggProviderAllTimeRelayPayments";

let isRunning = false;

export const aggProviderRelayPayments = async (db: PostgresJsDatabase) => {
    if (isRunning) {
        logger.info('aggProviderRelayPayments is already running. Exiting this call.');
        return;
    }

    isRunning = true;

    logger.info(`aggProviderHourlyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggProviderHourlyRelayPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggProviderHourlyRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggProviderHourlyRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`aggProviderDailyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggProviderDailyRelayPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggProviderDailyRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggProviderDailyRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`aggProviderAllTimeRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggProviderAllTimeRelayPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggProviderAllTimeRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggProviderAllTimeRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    isRunning = false;
}