// src/indexer/agregators/aggConsumerRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger } from "../../../utils";
import { aggConsumerHourlyRelayPayments } from "./aggConsumerHourlyRelayPayments";
import { aggConsumerDailyRelayPayments } from "./aggConsumerDailyRelayPayments";
import { aggConsumerAllTimeRelayPayments } from "./aggConsumerAllTimeRelayPayments";

let isRunning = false;

export const aggConsumerRelayPayments = async (db: PostgresJsDatabase) => {
    if (isRunning) {
        logger.info('aggConsumerRelayPayments is already running. Exiting this call.');
        return;
    }

    isRunning = true;

    logger.info(`aggConsumerHourlyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggConsumerHourlyRelayPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggConsumerHourlyRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggConsumerHourlyRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`aggConsumerDailyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggConsumerDailyRelayPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggConsumerDailyRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggConsumerDailyRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`aggConsumerAllTimeRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggConsumerAllTimeRelayPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggConsumerAllTimeRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggConsumerAllTimeRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    isRunning = false;
}