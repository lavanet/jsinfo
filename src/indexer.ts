// jsinfo/src/indexer.ts

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq, desc, and } from "drizzle-orm";
import * as lavajs from '@lavanet/lavajs';
import { PromisePool } from '@supercharge/promise-pool'
import * as schema from "./schema";
import { LavaBlock, GetOneLavaBlock } from './lavablock'
import { UpdateLatestBlockMeta } from './setlatest'
import { MigrateDb, GetDb, DoInChunks, logger, BackoffRetry, ConnectToRpc, RpcConnection } from "./utils";
import { updateAggHourlyPayments } from "./aggregate";

const rpc = process.env['LAVA_RPC'] as string
const n_workers = parseInt(process.env['N_WORKERS']!)
const batch_size = parseInt(process.env['BATCH_SIZE']!)
const poll_ms = parseInt(process.env['POLL_MS']!)
const lava_testnet2_start_height = parseInt(process.env['START_BLOCK']!) // 340778 has a weird date (9 months ago)
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
    //
    // We use a transaction to revert insert on any errors
    await db.transaction(async (tx) => {
        // insert block
        await tx.insert(schema.blocks).values({ height: block.height, datetime: new Date(block.datetime) })

        // Insert all specs
        const arrSpecs = Array.from(block.dbSpecs.values())
        await DoInChunks(100, arrSpecs, async (arr: any) => {
            await tx.insert(schema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Insert all Txs
        const arrTxs = Array.from(block.dbTxs.values())
        await DoInChunks(100, arrTxs, async (arr: any) => {
            await tx.insert(schema.txs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all providers
        const arrProviders = Array.from(block.dbProviders.values())
        await DoInChunks(100, arrProviders, async (arr: any) => {
            await tx.insert(schema.providers)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all plans
        const arrPlans = Array.from(block.dbPlans.values())
        await DoInChunks(100, arrPlans, async (arr: any) => {
            await tx.insert(schema.plans)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all consumers
        const arrConsumers = Array.from(block.dbConsumers.values())
        await DoInChunks(100, arrConsumers, async (arr: any) => {
            await tx.insert(schema.consumers)
                .values(arr)
                .onConflictDoNothing();
        })

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
    //
    // Start filling up
    logger.info('globakWorkList', globakWorkList.length, globakWorkList)
    const blockList = [...globakWorkList]
    globakWorkList.length = 0
    for (let i = dbHeight + 1; i <= latestHeight; i++) {
        blockList.push(i)
    }
    const org_len = blockList.length
    while (blockList.length > 0) {
        let start = performance.now();

        const tmpList = blockList.splice(0, batch_size);
        const { results, errors } = await PromisePool
            .withConcurrency(n_workers)
            .for(tmpList)
            .process(async (height) => {
                if (await isBlockInDb(db, height)) {
                    return
                }

                let block: null | LavaBlock = null;
                block = await GetOneLavaBlock(height, client, clientTm, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                if (block != null) {
                    await InsertBlock(block, db)
                } else {
                    logger.info('failed getting block', height)
                }
            })

        let timeTaken = performance.now() - start;
        logger.info(`
            Work: ${org_len}
            Errors: ${errors}
            Batches remaining: ${blockList.length / batch_size}
            Time: ${timeTaken / 1000}s
            Estimated remaining: ${Math.trunc((timeTaken / 1000) * blockList.length / batch_size)}s
        `);
        //
        // Add errors to global work list
        // to be tried again on the next iteration
        errors.forEach((err) => {
            globakWorkList.push(err.item)
        })
    }
}

const indexer = async (): Promise<void> => {
    logger.info(`starting indexer, rpc: ${rpc}, start height: ${lava_testnet2_start_height}`);

    const { client, clientTm, chainId, height, lavajsClient } =
        await BackoffRetry<RpcConnection>("ConnectToRpc", () => ConnectToRpc(rpc));

    //
    // DB
    await MigrateDb()
    let db = GetDb()

    //
    // Insert providers, specs & plans from latest block 
    await UpdateLatestBlockMeta(
        db,
        lavajsClient,
        height,
        false,
        static_dbProviders,
        static_dbSpecs,
        static_dbPlans,
        static_dbStakes
    )

    //
    // Loop forever, filling up blocks
    const loopFill = () => {
        logger.info(`loopFill function called at: ${new Date().toISOString()}`);
        setTimeout(() => {
            fillUpBackoffRetry();
            logger.info(`loopFill function finished at: ${new Date().toISOString()}`);
        }, poll_ms);
    }

    const updateAggHourlyPaymentsCaller = async () => {
        try {
            const start = Date.now();
            await updateAggHourlyPayments(db);
            const executionTime = Date.now() - start;
            logger.info(`Successfully executed db.updateAggHourlyPayments. Execution time: ${executionTime} ms`);
        } catch (e) {
            logger.error(`Failed to update aggregate hourly payments. Error: ${(e as Error).message}`);
        }
    }

    updateAggHourlyPaymentsCaller();

    const fillUp = async () => {
        //
        // Blockchain latest
        let latestHeight = 0;
        try {
            latestHeight = await BackoffRetry<number>("getHeight", async () => {
                return await client.getHeight();
            });
        } catch (e) {
            logger.info('client.getHeight', e)
            loopFill()
            return
        }

        //
        // Find latest block on DB
        let dbHeight = lava_testnet2_start_height
        let latestDbBlock
        try {
            latestDbBlock = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
        } catch (e) {
            logger.info('failed getting latestDbBlock', e)
            logger.info('restarting db connection')
            db = GetDb()
            loopFill()
            return
        }
        if (latestDbBlock.length != 0) {
            const tHeight = latestDbBlock[0].height
            if (tHeight != null) {
                dbHeight = tHeight
            }
        }

        //
        // Found diff, start
        if (latestHeight > dbHeight) {
            logger.info('db height', dbHeight, 'blockchain height', latestHeight)
            await doBatch(db, client, clientTm, dbHeight, latestHeight)

            //
            // Get the latest meta from RPC if not catching up
            // catching up = more than 1 block being indexed
            if (latestHeight - dbHeight == 1) {
                try {
                    await UpdateLatestBlockMeta(
                        db,
                        lavajsClient,
                        height,
                        true,
                        static_dbProviders,
                        static_dbSpecs,
                        static_dbPlans,
                        static_dbStakes
                    )
                } catch (e) {
                    logger.info('UpdateLatestBlockMeta', e)
                }

                updateAggHourlyPaymentsCaller();
            }
        }
        loopFill()
    }
    const fillUpBackoffRetry = async () => {
        try {
            await BackoffRetry<void>("fillUp", async () => { await fillUp(); });
        } catch (e) {
            logger.info('fillUpBackoffRetry error', e)
            loopFill()
            return
        }
    }
    fillUpBackoffRetry()
}

const indexerBackoffRetry = async () => {
    return await BackoffRetry<void>("indexer", async () => { await indexer(); });
}

try {
    indexerBackoffRetry();
} catch (error) {
    if (error instanceof Error) {
        logger.error('An error occurred while running the indexer:', error.message);
        logger.error('Stack trace:', error.stack);
    } else {
        logger.error('An unknown error occurred while running the indexer:', error);
    }
}