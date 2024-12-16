// src/indexer/agregators/AggConsumerRelayPayments.ts

import { logger } from "../../../utils/logger";
import { aggConsumerHourlyRelayPayments } from "./aggConsumerHourlyRelayPayments";
import { aggConsumerDailyRelayPayments } from "./aggConsumerDailyRelayPayments";
import { aggConsumerAllTimeRelayPayments } from "./aggConsumerAllTimeRelayPayments";

let isRunning = false;

export const AggConsumerRelayPayments = async () => {
    if (isRunning) {
        logger.info('AggConsumerRelayPayments is already running. Exiting this call.');
        return;
    }

    isRunning = true;

    logger.info(`aggConsumerHourlyRelayPayments started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await aggConsumerHourlyRelayPayments();
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
        await aggConsumerDailyRelayPayments();
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
        await aggConsumerAllTimeRelayPayments();
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed aggConsumerAllTimeRelayPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggConsumerAllTimeRelayPayments. Error: ${(e as Error).message}`, { stack: (e as Error).stack }, e);
        isRunning = false;
        return;
    }

    isRunning = false;
}