// jsinfo/src/indexer.ts

import * as consts from './indexer/indexerConsts';
import * as JsinfoSchema from "./schemas/jsinfoSchema/jsinfoSchema";

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, desc } from "drizzle-orm";
import { PromisePool } from '@supercharge/promise-pool'
import { GetOneLavaBlock } from './indexer/lavaBlock'
import { EventDebug } from './indexer/eventDebug'
import { LavaBlock } from './indexer/types'
import { SyncBlockchainEntities } from './indexer/blockchainEntities/blockchainEntitiesSync'
import { DoInChunks, logger, BackoffRetry, ConnectToRpc, RpcConnection } from "./utils";
import { MigrateDb, GetJsinfoDb } from "./dbUtils";
import { aggProviderAndConsumerRelayPayments, aggProviderAndConsumerRelayPaymentsSync } from './indexer/agregators/aggProviderAndConsumerRelayPayments';
import { SaveTokenSupplyToDB } from './indexer/supply/syncSupply';

let static_blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider> = new Map()
let static_blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec> = new Map()
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

        const arrSpecs = Array.from(block.dbSpecs.values())
        logger.debug(`Inserting ${arrSpecs.length} specs for block height: ${block.height}`);
        await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrSpecs, async (arr: any) => {
            await tx.insert(JsinfoSchema.specs)
                .values(arr)
                .onConflictDoNothing();
        })
        logger.debug(`Inserted specs for block height: ${block.height}`);

        const arrTxs = Array.from(block.dbTxs.values())
        logger.debug(`Inserting ${arrTxs.length} txs for block height: ${block.height}`);
        await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrTxs, async (arr: any) => {
            await tx.insert(JsinfoSchema.txs)
                .values(arr)
                .onConflictDoNothing();
        })
        logger.debug(`Inserted txs for block height: ${block.height}`);

        const arrProviders = Array.from(block.dbProviders.values())
        logger.debug(`Inserting ${arrProviders.length} providers for block height: ${block.height}`);
        await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrProviders, async (arr: any) => {
            await tx.insert(JsinfoSchema.providers)
                .values(arr)
                .onConflictDoNothing();
        })
        logger.debug(`Inserted providers for block height: ${block.height}`);

        // const arrPlans = Array.from(block.dbPlans.values())
        // // logger.debug(`Inserting ${arrPlans.length} plans for block height: ${block.height}`);
        // await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrPlans, async (arr: any) => {
        //     await tx.insert(JsinfoSchema.plans)
        //         .values(arr)
        //         .onConflictDoNothing();
        // })
        // //logger.debug(`Inserted plans for block height: ${block.height}`);

        const arrConsumers = Array.from(block.dbConsumers.values())

        // logger.debug(`Inserting ${arrConsumers.length} consumers for block height: ${block.height}`);
        await DoInChunks(consts.JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrConsumers, async (arr: any) => {
            await tx.insert(JsinfoSchema.consumers)
                .values(arr)
                .onConflictDoNothing();
        })
        // logger.debug(`Inserted consumers for block height: ${block.height}`);

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
                block = await GetOneLavaBlock(height, client, clientTm, static_blockchainEntitiesProviders, static_blockchainEntitiesSpecs, static_blockchainEntitiesStakes)
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

    if (consts.JSINFO_INDEXER_DEBUG_DUMP_EVENTS) {
        await EventDebug(rpcConnection);
        return
    }

    const db = await migrateAndFetchDb();
    logger.info('Done migrateAndFetchDb');
    await syncBlockchainEntitiesInDb(db, rpcConnection);
    logger.info('Done syncBlockchainEntitiesInDb');
    await aggProviderAndConsumerRelayPaymentsSync(db);
    logger.info('Done aggProviderAndConsumerRelayPaymentsSync');
    await SaveTokenSupplyToDB(db, rpcConnection.lavajsClient);
    logger.info('Done SaveTokenSupplyToDB');

    await fillUpBackoffRetry(db, rpcConnection);
    logger.info('Done fillUpBackoffRetry');
}

const establishRpcConnection = async (): Promise<RpcConnection> => {
    logger.info('Establishing RPC connection...');
    const rpcConnection: RpcConnection = await BackoffRetry<RpcConnection>("ConnectToRpc", () => ConnectToRpc(consts.JSINFO_INDEXER_LAVA_RPC));
    logger.info('RPC connection established.', rpcConnection);
    return rpcConnection;
}

const migrateAndFetchDb = async (): Promise<PostgresJsDatabase> => {
    if (consts.JSINFO_INDEXER_RUN_MIGRATIONS) {
        logger.info('Migrating DB...');
        await MigrateDb();
        logger.info('DB migrated.');
    }
    const db = GetJsinfoDb();
    logger.info('DB fetched.');
    return db;
}

const syncBlockchainEntitiesInDb = async (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {
    logger.info('syncing blockchain entities in db...');
    await SyncBlockchainEntities(
        db,
        rpcConnection.lavajsClient,
        rpcConnection.height,
        false,
        static_blockchainEntitiesProviders,
        static_blockchainEntitiesSpecs,
        static_blockchainEntitiesStakes
    );
    logger.info('Blockchain entities synced in db.');
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

    let dbHeight = consts.JSINFO_INDEXER_START_BLOCK;
    let latestDbBlock;
    try {
        latestDbBlock = await db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1);
        logger.info('fillUp: Successfully retrieved latest DB block');
    } catch (e) {
        logger.error(`fillUp: Error in getting latestDbBlock: ${e}`);
        logger.error('fillUp: Restarting DB connection');
        db = await GetJsinfoDb();
        fillUpBackoffRetryWTimeout(db, rpcConnection);
        return;
    }

    if (latestDbBlock.length != 0) {
        const tHeight = latestDbBlock[0].height;
        if (tHeight != null) {
            dbHeight = tHeight;
            logger.info(`fillUp: DB height set to latest DB block height: ${dbHeight}`);
        }
    }

    await doBatch(db, rpcConnection.client, rpcConnection.clientTm, dbHeight, latestHeight);

    if (latestHeight > dbHeight) {
        logger.info(`fillUp: Starting batch process for DB height ${dbHeight} and blockchain height ${latestHeight}`);
        await doBatch(db, rpcConnection.client, rpcConnection.clientTm, dbHeight, latestHeight);
        logger.info('fillUp: Batch process completed');

        if (latestHeight - dbHeight == 1) {
            logger.info('fillUp: Attempting to sync blockchain entities');
            try {
                await SyncBlockchainEntities(
                    db,
                    rpcConnection.lavajsClient,
                    rpcConnection.height,
                    true,
                    static_blockchainEntitiesProviders,
                    static_blockchainEntitiesSpecs,
                    static_blockchainEntitiesStakes
                );
                logger.info('fillUp: Successfully synced blockchain entities');
            } catch (e) {
                logger.info(`fillUp: Error in SyncBlockchainEntities: ${e}`);
            }
            aggProviderAndConsumerRelayPayments(db);
            logger.info('fillUp: Aggregated provider and consumer relay payments');
        }
    }

    await SaveTokenSupplyToDB(db, rpcConnection.lavajsClient);

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
