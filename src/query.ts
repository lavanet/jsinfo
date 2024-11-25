// jsinfo/src/query.ts

import * as consts from './query/queryConsts'
import { logger } from './utils/logger'

import { GetServerInstance } from './query/queryServer'
import { GetLatestBlock } from './query/utils/getLatestBlock'

import './query/queryRoutes'

export const queryServerMain = async (): Promise<void> => {
    logger.info('Starting query server on port ' + consts.JSINFO_QUERY_PORT + ' host ' + consts.JSINFO_QUERY_HOST)

    try {
        try {
            logger.info('Getting latest block')
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

async function setupMemoryDebug() {

    if (!consts.JSINFO_QUERY_MEMORY_DEBUG_MODE) return;
    const { heapStats } = await import("bun:jsc");
    const { generateHeapSnapshot } = await import("bun");
    const { writeFileSync } = await import("fs");

    function logHeapStats() {
        const stats = heapStats();
        const processStats = process.memoryUsage();

        console.log("\n=== Memory Usage ===");
        console.log(`Heap Size: ${(stats.heapSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Heap Capacity: ${(stats.heapCapacity / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Extra Memory: ${(stats.extraMemorySize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`RSS: ${(processStats.rss / 1024 / 1024).toFixed(2)}MB`);

        console.log(`\n=== Object Counts ===`);
        console.log(`Total Objects: ${stats.objectCount.toLocaleString()}`);
        console.log(`Protected Objects: ${stats.protectedObjectCount.toLocaleString()}`);
        console.log(`Global Objects: ${stats.globalObjectCount.toLocaleString()}`);
        console.log(`Protected Global Objects: ${stats.protectedGlobalObjectCount.toLocaleString()}`);

        console.log(`\n=== Object Types ===`);
        Object.entries(stats.objectTypeCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([type, count]) => {
                if (count > 1000) {
                    console.log(`${type}: ${count.toLocaleString()}`);
                }
            });

        console.log(`\n=== Protected Object Types ===`);
        Object.entries(stats.protectedObjectTypeCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`${type}: ${count.toLocaleString()}`);
            });

        const snapshot = generateHeapSnapshot();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        writeFileSync(`heap-snapshot-${timestamp}.json`, JSON.stringify(snapshot));
        console.log(`\nHeap snapshot saved to heap-snapshot-${timestamp}.json`);
    }

    // Log every 30 seconds
    setInterval(logHeapStats, 30000);
    logHeapStats(); // Initial log
}

// Call the setup function
setupMemoryDebug();
