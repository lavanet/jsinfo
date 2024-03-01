// jsinfo/src/indexer.ts

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, desc } from "drizzle-orm";
import { PromisePool } from '@supercharge/promise-pool'
import * as schema from "./schema";
import { LavaBlock, GetOneLavaBlock } from './lavablock'
import { UpdateLatestBlockMeta } from './setlatest'
import { MigrateDb, GetDb, DoInChunks, logger, BackoffRetry, ConnectToRpc, RpcConnection } from "./utils";
import { updateAggHourlyPayments } from "./aggregate";
import { GetEnvVar } from "./utils";

const JSINFO_INDEXER_LAVA_RPC = GetEnvVar("JSINFO_INDEXER_LAVA_RPC");
const JSINFO_INDEXER_N_WORKERS = parseInt(GetEnvVar('JSINFO_INDEXER_N_WORKERS'));
const JSINFO_INDEXER_BATCH_SIZE = parseInt(GetEnvVar('JSINFO_INDEXER_BATCH_SIZE'));
const JSINFO_INDEXER_POLL_MS = parseInt(GetEnvVar('JSINFO_INDEXER_POLL_MS'));
const JSINFO_INDEXER_START_BLOCK = parseInt(GetEnvVar('JSINFO_INDEXER_START_BLOCK')); // 340778 has a weird date (9 months ago)

let static_dbProviders: Map<string, schema.Provider> = new Map()
let static_dbSpecs: Map<string, schema.Spec> = new Map()
let static_dbPlans: Map<string, schema.Plan> = new Map()
let static_dbStakes: Map<string, schema.ProviderStake[]> = new Map()
const globakWorkList: number[] = []

async function isBlockInDb(
    db: PostgresJsDatabase,
    height: number,
): Promise<boolean> {
    //
    // Is in DB already?
    const dbBlock = await db.select().from(schema.blocks).where(eq(schema.blocks.height, height));
    if (dbBlock.length != 0) {
        return true
    }
    return false
}

async function InsertBlock(
    block: LavaBlock,
    db: PostgresJsDatabase,
) {
    logger.info(`Starting InsertBlock for block height: ${block.height}`);
    await db.transaction(async (tx) => {
        logger.debug(`Starting transaction for block height: ${block.height}`);
        await tx.insert(schema.blocks).values({ height: block.height, datetime: new Date(block.datetime) })
        logger.debug(`Inserted block height: ${block.height} into blocks`);

        const arrSpecs = Array.from(block.dbSpecs.values())
        logger.debug(`Inserting ${arrSpecs.length} specs for block height: ${block.height}`);
        await DoInChunks(100, arrSpecs, async (arr: any) => {
            await tx.insert(schema.specs)
                .values(arr)
                .onConflictDoNothing();
        })
        logger.debug(`Inserted specs for block height: ${block.height}`);

        const arrTxs = Array.from(block.dbTxs.values())
        logger.debug(`Inserting ${arrTxs.length} txs for block height: ${block.height}`);
        await DoInChunks(100, arrTxs, async (arr: any) => {
            await tx.insert(schema.txs)
                .values(arr)
                .onConflictDoNothing();
        })
        logger.debug(`Inserted txs for block height: ${block.height}`);

        const arrProviders = Array.from(block.dbProviders.values())
        logger.debug(`Inserting ${arrProviders.length} providers for block height: ${block.height}`);
        await DoInChunks(100, arrProviders, async (arr: any) => {
            await tx.insert(schema.providers)
                .values(arr)
                .onConflictDoNothing();
        })
        logger.debug(`Inserted providers for block height: ${block.height}`);

        const arrPlans = Array.from(block.dbPlans.values())
        // logger.debug(`Inserting ${arrPlans.length} plans for block height: ${block.height}`);
        await DoInChunks(100, arrPlans, async (arr: any) => {
            await tx.insert(schema.plans)
                .values(arr)
                .onConflictDoNothing();
        })
        //logger.debug(`Inserted plans for block height: ${block.height}`);

        const arrConsumers = Array.from(block.dbConsumers.values())
        // logger.debug(`Inserting ${arrConsumers.length} consumers for block height: ${block.height}`);
        await DoInChunks(100, arrConsumers, async (arr: any) => {
            await tx.insert(schema.consumers)
                .values(arr)
                .onConflictDoNothing();
        })
        // logger.debug(`Inserted consumers for block height: ${block.height}`);

        // Create
        await DoInChunks(100, block.dbEvents, async (arr: any) => {
            await tx.insert(schema.events).values(arr)
        })

        await DoInChunks(100, block.dbPayments, async (arr: any) => {
            await tx.insert(schema.relayPayments).values(arr)
        })

        await DoInChunks(100, block.dbConflictResponses, async (arr: any) => {
            await tx.insert(schema.conflictResponses).values(arr)
        })

        await DoInChunks(100, block.dbSubscriptionBuys, async (arr: any) => {
            await tx.insert(schema.subscriptionBuys).values(arr)
        })

        await DoInChunks(100, block.dbConflictVote, async (arr: any) => {
            await tx.insert(schema.conflictVotes).values(arr)
        })

        await DoInChunks(100, block.dbProviderReports, async (arr: any) => {
            await tx.insert(schema.providerReported).values(arr)
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
    logger.info(`doBatch:: Starting doBatch with dbHeight: ${dbHeight}, latestHeight: ${latestHeight}`);

    const blockList = [...globakWorkList]
    logger.info(`doBatch:: Initial blockList length: ${blockList.length}`);
    globakWorkList.length = 0
    for (let i = dbHeight + 1; i <= latestHeight; i++) {
        blockList.push(i)
    }
    const org_len = blockList.length
    logger.info(`doBatch:: Updated blockList length: ${org_len}`);
    while (blockList.length > 0) {
        let start = performance.now();

        const tmpList = blockList.splice(0, JSINFO_INDEXER_BATCH_SIZE);
        logger.info(`doBatch:: Processing batch of size: ${tmpList.length}`);
        const { results, errors } = await PromisePool
            .withConcurrency(JSINFO_INDEXER_N_WORKERS)
            .for(tmpList)
            .process(async (height) => {
                if (await isBlockInDb(db, height)) {
                    logger.info(`doBatch:: Block ${height} already in DB, skipping`);
                    return
                }

                let block: null | LavaBlock = null;
                block = await GetOneLavaBlock(height, client, clientTm, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                if (block != null) {
                    await InsertBlock(block, db)
                    logger.info(`doBatch:: Inserted block ${height} into DB`);
                } else {
                    logger.info(`doBatch:: Failed getting block ${height}`);
                }
            })

        let timeTaken = performance.now() - start;
        logger.info(`
                Work: ${org_len}
                Errors: ${errors}
                Batches remaining: ${blockList.length / JSINFO_INDEXER_BATCH_SIZE}
                Time: ${timeTaken / 1000}s
                Estimated remaining: ${Math.trunc((timeTaken / 1000) * blockList.length / JSINFO_INDEXER_BATCH_SIZE)}s
            `);
        errors.forEach((err) => {
            globakWorkList.push(err.item)
            logger.info(`doBatch:: Added block ${err.item} to globakWorkList due to error`);
        })
    }
    logger.info(`doBatch:: Finished doBatch with dbHeight: ${dbHeight}, latestHeight: ${latestHeight}`);
}

const indexer = async (): Promise<void> => {
    logger.info(`Starting indexer, rpc: ${JSINFO_INDEXER_LAVA_RPC}, start height: ${JSINFO_INDEXER_START_BLOCK}`);

    const rpcConnection = await establishRpcConnection();
    const db = await migrateAndFetchDb();
    await updateBlockMetaInDb(db, rpcConnection);
    await updateAggHourlyPaymentsCaller(db);
    await fillUpBackoffRetry(db, rpcConnection);
}

const establishRpcConnection = async (): Promise<RpcConnection> => {
    logger.info('Establishing RPC connection...');
    const rpcConnection: RpcConnection = await BackoffRetry<RpcConnection>("ConnectToRpc", () => ConnectToRpc(JSINFO_INDEXER_LAVA_RPC));
    logger.info('RPC connection established.', rpcConnection);
    return rpcConnection;
}

const migrateAndFetchDb = async (): Promise<PostgresJsDatabase> => {
    logger.info('Migrating DB...');
    await MigrateDb();
    logger.info('DB migrated.');
    const db = GetDb();
    logger.info('DB fetched.');
    return db;
}

const updateBlockMetaInDb = async (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {
    logger.info('Updating block meta...');
    await UpdateLatestBlockMeta(
        db,
        rpcConnection.lavajsClient,
        rpcConnection.height,
        false,
        static_dbProviders,
        static_dbSpecs,
        static_dbPlans,
        static_dbStakes
    );
    logger.info('Block meta updated.');
}

const fillUpBackoffRetry = async (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {
    logger.info('fillUpBackoffRetry:: Filling up blocks...');
    try {
        await BackoffRetry<void>("fillUp", async () => { await fillUp(db, rpcConnection); });
    } catch (e) {
        logger.info('fillUpBackoffRetry error', e)
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
    }, JSINFO_INDEXER_POLL_MS);
}

const updateAggHourlyPaymentsCaller = async (db: PostgresJsDatabase) => {
    logger.info(`updateAggHourlyPaymentsCaller started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await updateAggHourlyPayments(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed db.updateAggHourlyPayments. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to update aggregate hourly payments. Error: ${(e as Error).message}`);
    }
}

const fillUp = async (db: PostgresJsDatabase, rpcConnection: RpcConnection) => {
    let latestHeight = 0;
    try {
        latestHeight = await BackoffRetry<number>("getHeight", async () => {
            return await rpcConnection.client.getHeight();
        });
    } catch (e) {
        logger.info(`client.getHeight ${e}`);
        fillUpBackoffRetryWTimeout(db, rpcConnection)
        return
    }

    let dbHeight = JSINFO_INDEXER_START_BLOCK
    let latestDbBlock
    try {
        latestDbBlock = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
    } catch (e) {
        logger.info(`failed getting latestDbBlock ${e}`);
        logger.info('restarting db connection')
        db = await GetDb()
        fillUpBackoffRetryWTimeout(db, rpcConnection)
        return
    }
    if (latestDbBlock.length != 0) {
        const tHeight = latestDbBlock[0].height
        if (tHeight != null) {
            dbHeight = tHeight
        }
    }

    if (latestHeight > dbHeight) {
        logger.info(`db height ${dbHeight}, blockchain height ${latestHeight}`);
        await doBatch(db, rpcConnection.client, rpcConnection.clientTm, dbHeight, latestHeight)

        if (latestHeight - dbHeight == 1) {
            try {
                await UpdateLatestBlockMeta(
                    db,
                    rpcConnection.lavajsClient,
                    rpcConnection.height,
                    true,
                    static_dbProviders,
                    static_dbSpecs,
                    static_dbPlans,
                    static_dbStakes
                )
            } catch (e) {
                logger.info(`UpdateLatestBlockMeta ${e}`);
            }
            updateAggHourlyPaymentsCaller(db);
        }
    }
    fillUpBackoffRetryWTimeout(db, rpcConnection)
}

const indexerBackoffRetry = async () => {
    return await BackoffRetry<void>("indexer", async () => { await indexer(); });
}

try {
    indexerBackoffRetry();
} catch (error) {
    if (error instanceof Error) {
        console.log('An error occurred while running the indexer:', error.message);
        console.log('Stack trace:', error.stack);
    } else {
        console.log('An unknown error occurred while running the indexer:', error);
    }
}