// jsinfo/src/indexer.ts

import { logger } from '@jsinfo/utils/logger';
import { DoInChunks } from '@jsinfo/utils/processing';
import { IsIndexerProcess } from '@jsinfo/utils/env';

if (!IsIndexerProcess()) {
    console.log('indexer.ts', "not indexer process");
    process.exit();
}

import * as consts from './indexerConsts';
import * as JsinfoSchema from "../schemas/jsinfoSchema/jsinfoSchema";

import { eq, desc } from "drizzle-orm";
import { PromisePool } from '@supercharge/promise-pool'
import { GetOneLavaBlock } from './lavaBlock'
import { LavaBlock } from './lavaTypes'
import { queryRpc } from "./utils/lavajsRpc";
import { queryJsinfo } from '../utils/db';

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
        if (blockList.length >= 1000) {
            break;
        }
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
                block = await GetOneLavaBlock(height)
                if (block != null) {
                    await InsertBlock(block)
                    logger.info(`doBatch: Inserted block ${height} into DB`);
                } else {
                    logger.info(`doBatch: Failed getting block ${height}`);
                }

                const index = globakWorkList.indexOf(height);
                if (index > -1) {
                    globakWorkList.splice(index, 1);
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
        if (errors.length > 0) {
            errors.forEach((err) => {
                globakWorkList.push(err.item);
                logger.info(`doBatch: Added block ${err.item} to globakWorkList due to error`);
            });

            // Wait until globakWorkList has fewer than 100 items
            while (globakWorkList.length >= 1000) {
                // logger.info(`doBatch: Waiting for globakWorkList to reduce below 100 items...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 100ms
            }
        }

        // After processing each block successfully, remove it from globakWorkList
        const successfulBlocks = tmpList.filter(height => !errors.some(err => err.item === height));
        successfulBlocks.forEach(block => {
            const index = globakWorkList.indexOf(block);
            if (index > -1) {
                globakWorkList.splice(index, 1); // Remove the successfully processed block
                logger.info(`doBatch: Removed block ${block} from globakWorkList after successful processing`);
            }
        });
    }
    logger.info(`doBatch: Finished doBatch with dbHeight: ${dbHeight}, latestHeight: ${latestHeight}`);
}

// Global variable to store the start time
let fullUpStartTime: number | null = null;

export const FillUpBlocks = async () => {
    try {
        if (fullUpStartTime === null) {
            fullUpStartTime = Date.now();
        }

        let latestHeight = await queryRpc(
            async (client) => await client.getHeight(),
            "getHeight"
        );
        logger.info(`fillUp: Successfully retrieved latest blockchain height: ${latestHeight}`);

        let latestDbBlockRes;
        try {
            latestDbBlockRes = await queryJsinfo(
                async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
                'getLatestDbBlock'
            );
        } catch (error) {
            logger.error('fillUp: Failed to get latest db block:', error);
        }

        const latestDbBlock = latestDbBlockRes?.[0]?.height || 0;
        const cBlockHeight = latestDbBlock != 0 ?
            Math.max(consts.JSINFO_INDEXER_START_BLOCK, latestDbBlock) :
            consts.JSINFO_INDEXER_START_BLOCK;

        logger.info(`fillUp: Starting batch process for DB height ${cBlockHeight} and blockchain height ${latestHeight}`);
        await doBatch(cBlockHeight, latestHeight);
        logger.info('fillUp: Batch process completed');

        // Verify completion
        const latestDbBlock2 = (await queryJsinfo(
            async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
            'getLatestDbBlock2'
        ))[0]?.height || 0;

        if (latestDbBlock2 === 0 || latestHeight !== latestDbBlock2) {
            throw new Error(`Batch processing incomplete: latest height ${latestHeight}, db height ${latestDbBlock2}`);
        }

    } catch (error) {
        logger.error('fillUp error:', error);
        throw error; // Let the BackoffRetry handle the retry
    }

};


