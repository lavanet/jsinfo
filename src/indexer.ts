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

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, desc } from "drizzle-orm";
import { PromisePool } from '@supercharge/promise-pool'
import { GetOneLavaBlock } from './indexer/lavaBlock'
import { LavaBlock } from './indexer/types'
import { SyncBlockchainEntities } from './indexer/blockchainEntities/blockchainEntitiesSync'
import { ConnectToRpc, RpcConnection } from "./indexer/utils/lavajsRpc";
import { MigrateDb, GetJsinfoDbForIndexer } from "./utils/db";
import { AggProviderAndConsumerRelayPayments, AggProviderAndConsumerRelayPaymentsSync } from "./indexer/agregators/aggProviderAndConsumerRelayPayments";
import { BackgroundThreadCaller } from './indexer/backgroundThreadCaller';

let static_blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]> = new Map()

const globakWorkList: number[] = []

async function isBlockInDb(
    db: PostgresJsDatabase,
    height: number,
): Promise<boolean> {
    // Is in DB already?
    const dbBlock = await db.select().from(JsinfoSchema.blocks).where(eq(JsinfoSchema.blocks.height, height));
    return dbBlock.length != 0;
}

async function InsertBlock(
    block: LavaBlock,
    db: PostgresJsDatabase,
) {
    logger.info(`Starting InsertBlock for block height: ${block.height}`);
    await db.transaction(async (tx) => {
        logger.debug(`Starting transaction for block height: ${block.height}`);
        await tx.insert(JsinfoSchema.blocks).values({ height: block.height, datetime: new Date(block.datetime) })
        logger.debug(`Inserted block height: ${block.height} into blocks`);
        // Create
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
    })
}

const doBatch = async (
    db: PostgresJsDatabase,
    client: StargateClient,
    clientTm: Tendermint37Client,
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
                if (await isBlockInDb(db, height)) {
                    logger.info(`doBatch: Block ${height} already in DB, skipping`);
                    return
                }

                let block: null | LavaBlock = null;
                block = await GetOneLavaBlock(height, client, clientTm, static_blockchainEntitiesStakes)
                if (block != null) {
                    await InsertBlock(block, db)
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

    const rpcConnection = await establishRpcConnection();

    const db = await migrateAndFetchDb();
    logger.info('Done migrateAndFetchDb');

    // Verify the output returned at least one entry
    try {
        logger.info('Attempting to retrieve the latest block from the database...');
        const latestBlock = await db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1);
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

    await AggProviderAndConsumerRelayPaymentsSync(db);
    logger.info('Done AggProviderAndConsumerRelayPaymentsSync');
    await BackgroundThreadCaller(db, rpcConnection.lavajsClient);
    logger.info('Done BackgroundThreadCaller');

    await fillUpBackoffRetry(db, rpcConnection);
    logger.info('Done fillUpBackoffRetry');
}

const establishRpcConnection = async (): Promise<RpcConnection> => {
    logger.info('Establishing RPC connection...');
    const rpcConnection: RpcConnection = await BackoffRetry<RpcConnection>("ConnectToRpc", () => ConnectToRpc(consts.JSINFO_INDEXER_LAVA_RPC));
    logger.info('RPC connection established.');
    return rpcConnection;
}

const migrateAndFetchDb = async (): Promise<PostgresJsDatabase> => {
    if (consts.JSINFO_INDEXER_RUN_MIGRATIONS) {
        logger.info('Migrating DB...');
        await MigrateDb();
        logger.info('DB migrated.');
    }
    const db = GetJsinfoDbForIndexer();
    logger.info('DB fetched.');
    return db;
}

const fillUpBackoffRetry = async (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {
    logger.info('fillUpBackoffRetry:: Filling up blocks...');
    try {
        await BackoffRetry<void>("fillUp", async () => { await fillUp(db, rpcConnection); });
    } catch (e) {
        logger.error('fillUpBackoffRetry error', e)
        fillUpBackoffRetryWTimeout(db, rpcConnection)
        return
    }
    logger.info('fillUpBackoffRetry:: Blocks filled up.');
}

const fillUpBackoffRetryWTimeout = (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {
    logger.info(`fillUpBackoffRetryWTimeout function called at: ${new Date().toISOString()}`);
    setTimeout(() => {
        fillUpBackoffRetry(db, rpcConnection);
        logger.info(`fillUpBackoffRetryWTimeout function finished at: ${new Date().toISOString()}`);
    }, consts.JSINFO_INDEXER_POLL_MS);
}

// Global variable to store the start time
let fullUpStartTime: number | null = null;

const fillUp = async (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {

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
        latestHeight = await BackoffRetry<number>("getHeight", async () => {
            return await rpcConnection.client.getHeight();
        });
        logger.info(`fillUp: Successfully retrieved latest blockchain height: ${latestHeight}`);
    } catch (e) {
        logger.error(`fillUp: Error in client.getHeight: ${e}`);
        fillUpBackoffRetryWTimeout(db, rpcConnection);
        return;
    }

    let latestDbBlock = 0;
    try {
        const latestDbBlockRes = await db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1);
        latestDbBlock = latestDbBlockRes[0]?.height || 0;
        logger.info('fillUp: Successfully retrieved latest DB block');
    } catch (e) {
        logger.error(`fillUp: Error in getting latestDbBlock: ${e}`);
        logger.error('fillUp: Restarting DB connection');
        db = await GetJsinfoDbForIndexer();
        fillUpBackoffRetryWTimeout(db, rpcConnection);
        return;
    }

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
    await doBatch(db, rpcConnection.client, rpcConnection.clientTm, cBlockHeight, latestHeight);
    logger.info('fillUp: Batch process completed');

    let latestDbBlock2 = 0;
    try {
        const latestDbBlock2Res = await db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1);
        latestDbBlock2 = latestDbBlock2Res[0]?.height || 0;
        logger.info('fillUp: Successfully retrieved latest DB block');
    } catch (e) {
        logger.error(`fillUp: Error in getting latestDbBlock: ${e}`);
        logger.error('fillUp: Restarting DB connection');
        db = await GetJsinfoDbForIndexer();
        fillUpBackoffRetryWTimeout(db, rpcConnection);
        return;
    }

    if (latestDbBlock2 == 0) {
        logger.error(`fillUp: Error calling doBatch to fill db with new blocks. latestDbBlock2 == 0`);
        logger.error('fillUp: Restarting DB connection');
        db = await GetJsinfoDbForIndexer();
        fillUpBackoffRetryWTimeout(db, rpcConnection);
        return;
    }

    if (latestHeight != latestDbBlock2) {
        logger.error(`fillUp: latestHeight ${latestHeight} != latestDbBlock2[0].height ${latestDbBlock2[0].height}`);
        db = await GetJsinfoDbForIndexer();
        fillUpBackoffRetryWTimeout(db, rpcConnection);
        return;
    }

    logger.info('fillUp: Attempting to sync blockchain entities');
    try {
        await SyncBlockchainEntities(
            db,
            rpcConnection.lavajsClient,
            latestHeight,
            static_blockchainEntitiesStakes
        );
        logger.info('fillUp: Successfully synced blockchain entities');
    } catch (e) {
        logger.info(`fillUp: Error in SyncBlockchainEntities: ${e}`);
    }

    AggProviderAndConsumerRelayPayments(db);
    BackgroundThreadCaller(db, rpcConnection.lavajsClient);

    fillUpBackoffRetryWTimeout(db, rpcConnection);
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
