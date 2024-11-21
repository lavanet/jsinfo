// src/indexer/agregators/AggProviderRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger } from "../../../utils/logger";
import { aggProviderHourlyRelayPayments } from "./aggProviderHourlyRelayPayments";
import { aggProviderDailyRelayPayments } from "./aggProviderDailyRelayPayments";
import { aggProviderAllTimeRelayPayments } from "./aggProviderAllTimeRelayPayments";

let isRunning = false;

export const AggProviderRelayPayments = async () => {
    if (isRunning) {
        logger.info('AggProviderRelayPayments is already running. Exiting this call.');
        return;
    }

    isRunning = true;

    logger.info(`aggProviderHourlyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggProviderHourlyRelayPayments();
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggProviderHourlyRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        const error = e as Error;
        logger.error(`Failed to update aggProviderHourlyRelayPayments. Error: ${error.message}`, {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
        isRunning = false;
        return;
    }

    logger.info(`aggProviderDailyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggProviderDailyRelayPayments();
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
        await aggProviderAllTimeRelayPayments();
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggProviderAllTimeRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggProviderAllTimeRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    isRunning = false;
}