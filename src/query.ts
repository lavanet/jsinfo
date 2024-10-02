// jsinfo/src/query.ts

require('dotenv').config();

import * as consts from './query/queryConsts'
import { logger } from './utils/utils'

import { GetServerInstance } from './query/queryServer'
import { QueryInitJsinfoDbInstance, QueryInitJsinfoReadDbInstance, QueryInitRelaysReadDbInstance, GetLatestBlock } from './query/queryDb'

import './query/queryRoutes'

export const queryServerMain = async (): Promise<void> => {
    logger.info('Starting query server')

    await QueryInitJsinfoDbInstance()
    await QueryInitJsinfoReadDbInstance()
    await QueryInitRelaysReadDbInstance()

    try {
        try {
            const { latestHeight, latestDatetime } = await GetLatestBlock()
            logger.info(`block ${latestHeight} block time ${latestDatetime}`)
        } catch (err) {
            logger.error('failed to connect get block from db')
            logger.error(String(err))
            logger.error('Sleeping one second before exit')
            await new Promise(resolve => setTimeout(resolve, 1000));
            process.exit(1)
        }

        logger.info(`listening on ${consts.JSINFO_QUERY_PORT} ${consts.JSINFO_QUERY_HOST}`)
        await GetServerInstance().listen({ port: consts.JSINFO_QUERY_PORT, host: consts.JSINFO_QUERY_HOST })
    } catch (err) {
        logger.error(String(err))
        logger.error('Sleeping one second before exit')
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(1)
    }
}


try {
    console.info(`QueryCache:: JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS: ${consts.JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS}`);
    console.info(`QueryCache:: JSINFO_QUERY_HIGH_POST_BODY_LIMIT: ${consts.JSINFO_QUERY_HIGH_POST_BODY_LIMIT}`);

    queryServerMain();
} catch (error) {
    if (error instanceof Error) {
        console.error('An error occurred while running the queryserver:', error.message);
        console.error('Stack trace:', error.stack);
    } else {
        console.error('An unknown error occurred while running the queryserver:', error);
    }
}

// import { heapStats } from "bun:jsc";

// import { generateHeapSnapshot } from "bun";

// function logHeapStats() {
//     console.log("Heap Stats:", JSON.stringify(heapStats(), null, 2));
//     const snapshot = generateHeapSnapshot();
//     Bun.write("heap.json", JSON.stringify(snapshot, null, 2));
// }

// const HEAP_STATS_INTERVAL = 30000; // 30 seconds in milliseconds
// setInterval(logHeapStats, HEAP_STATS_INTERVAL);

// logHeapStats();
