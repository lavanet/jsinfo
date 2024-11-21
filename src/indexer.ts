// jsinfo/src/indexer.ts

import { logger } from '@jsinfo/utils/logger';
import { DoInChunks } from '@jsinfo/utils/processing';
import { BackoffRetry } from '@jsinfo/utils/retry';
import { IsIndexerProcess } from '@jsinfo/utils/env';

if (!IsIndexerProcess()) {
    console.log('indexer.ts', "not indexer process");
    process.exit();
}

import * as consts from './indexer/indexerConsts';
import * as JsinfoSchema from "./schemas/jsinfoSchema/jsinfoSchema";

import { eq, desc } from "drizzle-orm";
import { PromisePool } from '@supercharge/promise-pool'
import { GetOneLavaBlock } from './indexer/lavaBlock'
import { LavaBlock } from './indexer/lavaTypes'
import { SyncBlockchainEntities } from './indexer/blockchainEntities/blockchainEntitiesSync'
import { queryRpc } from "./indexer/utils/lavajsRpc";
import { BackgroundThreadCaller } from './indexer/backgroundThreadCaller';
import { queryJsinfo } from './utils/db';

let static_blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]> = new Map()

const globakWorkList: number[] = []

async function isBlockInDb(height: number): Promise<boolean> {
    const dbBlock = await queryJsinfo(
        async (db) => db.select().from(JsinfoSchema.blocks).where(eq(JsinfoSchema.blocks.height, height)),
        'isBlockInDb'
    );
    return dbBlock.length != 0;
}

async function InsertBlock(block: LavaBlock) {
    logger.info(`Starting InsertBlock for block height: ${block.height}`);

    await queryJsinfo(
        async (db) => {
            await db.transaction(async (tx) => {
                logger.debug(`Starting transaction for block height: ${block.height}`);
                await tx.insert(JsinfoSchema.blocks).values({ height: block.height, datetime: new Date(block.datetime) })
                logger.debug(`Inserted block height: ${block.height} into blocks`);

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbEvents, async (arr: any) => {
                    await tx.insert(JsinfoSchema.events).values(arr)
                })

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbPayments, async (arr: any) => {
                    await tx.insert(JsinfoSchema.relayPayments).values(arr)
                })

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbConflictResponses, async (arr: any) => {
                    await tx.insert(JsinfoSchema.conflictResponses).values(arr)
                })

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbSubscriptionBuys, async (arr: any) => {
                    await tx.insert(JsinfoSchema.subscriptionBuys).values(arr)
                })

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbConflictVote, async (arr: any) => {
                    await tx.insert(JsinfoSchema.conflictVotes).values(arr)
                })

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbProviderReports, async (arr: any) => {
                    await tx.insert(JsinfoSchema.providerReported).values(arr)
                })

                await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, block.dbProviderLatestBlockReports, async (arr: any) => {
                    await tx.insert(JsinfoSchema.providerLatestBlockReports).values(arr)
                })
            });
            return { success: true };
        },
        `insertBlock_${block.height}`
    );
}

const doBatch = async (
    dbHeight: number,
    latestHeight: number,
) => {
    logger.info(`doBatch: Starting doBatch with dbHeight: ${dbHeight}, latestHeight: ${latestHeight}`);

    const blockList = [...globakWorkList]
    logger.info(`doBatch: Initial blockList length: ${blockList.length}`);
    globakWorkList.length = 0

    for (let i = dbHeight + 1; i <= latestHeight; i++) {
        blockList.push(i);
    }

    const org_len = blockList.length
    logger.info(`doBatch: Updated blockList length: ${org_len}`);
    while (blockList.length > 0) {
        let start = performance.now();

        const tmpList = blockList.splice(0, consts.JSINFO_INDEXER_BATCH_SIZE);
        logger.info(`doBatch: Processing batch of size: ${tmpList.length}`);
        const { results, errors } = await PromisePool
            .withConcurrency(consts.JSINFO_INDEXER_N_WORKERS)
            .for(tmpList)
            .process(async (height) => {
                if (await isBlockInDb(height)) {
                    logger.info(`doBatch: Block ${height} already in DB, skipping`);
                    return
                }

                let block: null | LavaBlock = null;
                block = await GetOneLavaBlock(height, static_blockchainEntitiesStakes)
                if (block != null) {
                    await InsertBlock(block)
                    logger.info(`doBatch: Inserted block ${height} into DB`);
                } else {
                    logger.info(`doBatch: Failed getting block ${height}`);
                }
            })

        let timeTaken = performance.now() - start;
        logger.info(`
                Work: ${org_len}
                Errors: ${errors}
                Batches remaining: ${blockList.length / consts.JSINFO_INDEXER_BATCH_SIZE}
                Time: ${timeTaken / 1000}s
                Estimated remaining: ${Math.trunc((timeTaken / 1000) * blockList.length / consts.JSINFO_INDEXER_BATCH_SIZE)}s
            `);
        errors.forEach((err) => {
            globakWorkList.push(err.item)
            logger.info(`doBatch: Added block ${err.item} to globakWorkList due to error`);
        })
    }
    logger.info(`doBatch: Finished doBatch with dbHeight: ${dbHeight}, latestHeight: ${latestHeight}`);
}

const indexer = async (): Promise<void> => {
    logger.info(`Starting indexer, rpc: ${consts.JSINFO_INDEXER_LAVA_RPC}, start height: ${consts.JSINFO_INDEXER_START_BLOCK}`);

    for (const key in consts) {
        if (Object.hasOwnProperty.call(consts, key)) {
            logger.info(`${key}: ${consts[key]}`);
        }
    }

    // Verify the output returned at least one entry
    try {
        logger.info('Attempting to retrieve the latest block from the database...');
        const latestBlock = await queryJsinfo(
            async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
            'getLatestDbBlock'
        );
        logger.info(`Query executed. Result: ${JSON.stringify(latestBlock)}`);

        if (latestBlock.length > 0) {
            logger.info(`Latest block: ${JSON.stringify(latestBlock[0])}`);
        } else {
            logger.warn('No latest block found.');
        }
    } catch (e) {
        const error = e as Error;
        logger.error(`Failed to retrieve the latest block. Error: ${error.message}`, {
            name: error.name,
            message: error.message,
            stack: error.stack,
            originalError: e, // Log the original error object
        });
        return;
    }

    await fillUpBackoffRetry();
    logger.info('Done fillUpBackoffRetry');
}

const fillUpBackoffRetry = async () => {
    logger.info('fillUpBackoffRetry:: Filling up blocks...');
    try {
        await BackoffRetry<void>("fillUp", async () => { await fillUp(); });
    } catch (e) {
        logger.error('fillUpBackoffRetry error', e)
        fillUpBackoffRetryWTimeout()
        return
    }
    logger.info('fillUpBackoffRetry:: Blocks filled up.');
}

const fillUpBackoffRetryWTimeout = () => {
    logger.info(`fillUpBackoffRetryWTimeout function called at: ${new Date().toISOString()}`);
    setTimeout(() => {
        fillUpBackoffRetry();
        logger.info(`fillUpBackoffRetryWTimeout function finished at: ${new Date().toISOString()}`);
    }, consts.JSINFO_INDEXER_POLL_MS);
}

// Global variable to store the start time
let fullUpStartTime: number | null = null;

const fillUp = async () => {
    BackgroundThreadCaller();
    // Set the start time on the first call
    if (fullUpStartTime === null) {
        fullUpStartTime = Date.now();
    }

    // Check if JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS has passed
    if (Date.now() - fullUpStartTime > consts.JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS * 60 * 60 * 1000) {
        logger.info('fillUp: JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS has passed. Exiting process.');
        process.exit();
    }

    let latestHeight = 0;
    try {
        latestHeight = await queryRpc(
            async (client, clientTm) => {
                return await client.getHeight();
            },
            "getHeight"
        );
        logger.info(`fillUp: Successfully retrieved latest blockchain height: ${latestHeight}`);
    } catch (e) {
        logger.error(`fillUp: Error in client.getHeight: ${e}`);
        fillUpBackoffRetryWTimeout();
        return;
    }

    const latestDbBlockRes = await queryJsinfo(
        async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
        'getLatestDbBlock'
    );
    const latestDbBlock = latestDbBlockRes[0]?.height || 0;

    let cBlockHeight = 0;
    try {
        cBlockHeight = latestDbBlock != 0 ? Math.max(consts.JSINFO_INDEXER_START_BLOCK, latestDbBlock) : consts.JSINFO_INDEXER_START_BLOCK;
        logger.info(`fillUp: Heights (pre fillup):: latestDbBlock: ${latestDbBlock}, cBlockHeight: ${cBlockHeight}`);
    } catch (error) {
        logger.error(`Error accessing height: ${error}`);
        logger.error(`Type of latestDbBlock[0]: ${typeof latestDbBlock}`);
        logger.error(`Value of latestDbBlock[0]: ${JSON.stringify(latestDbBlock)}`);
    }

    logger.info(`fillUp: Starting batch process for DB height ${cBlockHeight} and blockchain height ${latestHeight}`);
    await doBatch(cBlockHeight, latestHeight);
    logger.info('fillUp: Batch process completed');

    const latestDbBlock2Res = await queryJsinfo(
        async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
        'getLatestDbBlock2'
    );
    const latestDbBlock2 = latestDbBlock2Res[0]?.height || 0;

    if (latestDbBlock2 == 0) {
        logger.error(`fillUp: Error calling doBatch to fill db with new blocks. latestDbBlock2 == 0`);
        logger.error('fillUp: Restarting DB connection');
        fillUpBackoffRetryWTimeout();
        return;
    }

    if (latestHeight != latestDbBlock2) {
        logger.error(`fillUp: latestHeight ${latestHeight} != latestDbBlock2[0].height ${latestDbBlock2[0].height}`);
        fillUpBackoffRetryWTimeout();
        return;
    }

    logger.info('fillUp: Attempting to sync blockchain entities');
    try {
        await SyncBlockchainEntities(
            latestHeight,
            static_blockchainEntitiesStakes
        );
        logger.info('fillUp: Successfully synced blockchain entities');
    } catch (e) {
        logger.info(`fillUp: Error in SyncBlockchainEntities: ${e}`);
    }

    fillUpBackoffRetryWTimeout();
    logger.info('fillUp: process completed');
}

try {
    indexer()
} catch (error) {
    if (error instanceof Error) {
        console.log('An error occurred while running the indexer:', error.message);
        console.log('Stack trace:', error.stack);
    } else {
        console.log('An unknown error occurred while running the indexer:', error);
    }
}
