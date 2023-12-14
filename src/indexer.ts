import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, desc } from "drizzle-orm";
import * as lavajs from '@lavanet/lavajs';
import * as schema from './schema';
import { PromisePool } from '@supercharge/promise-pool'
import { LavaBlock, GetOneLavaBlock } from './lavablock'
import { UpdateLatestBlockMeta } from './setlatest'
import { MigrateDb, GetDb, DoInChunks } from "./utils";

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
    console.log('globakWorkList', globakWorkList.length, globakWorkList)
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
                    console.log('failed getting block', height)
                }
            })

        let timeTaken = performance.now() - start;
        console.log(
            'work', org_len,
            'errors', errors,
            'batches remaining:', blockList.length / batch_size,
            'time', timeTaken / 1000,
            'est remaining:', Math.trunc((timeTaken / 1000) * blockList.length / batch_size), 's'
        )
        //
        // Add errors to global work list
        // to be tried again on the next iteration
        errors.forEach((err) => {
            globakWorkList.push(err.item)
        })
    }
}

const indexer = async (): Promise<void> => {
    console.log(`starting indexer, rpc: ${rpc}, start height: ${lava_testnet2_start_height}`)
    //
    // Client
    let client: StargateClient;
    try {
        client = await StargateClient.connect(rpc);
    } catch (e) {
        console.error(`Error connecting to ${rpc}:`, e instanceof Error ? e.message : e);
        return;
    }  
    const clientTm = await Tendermint37Client.connect(rpc)
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    const lavajsClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc })
    console.log('chain', chainId, 'current height', height)

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
    const loopFill = () => (setTimeout(fillUp, poll_ms))
    const fillUp = async () => {
        //
        // Blockchain latest
        let latestHeight = 0
        try {
            latestHeight = await client.getHeight();
        } catch (e) {
            console.log('client.getHeight', e)
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
            console.log('failed getting latestDbBlock', e)
            console.log('restarting db connection')
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
            console.log('db height', dbHeight, 'blockchain height', latestHeight)
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
                    console.log('UpdateLatestBlockMeta', e)
                }
                try {
                    await db.refreshMaterializedView(schema.relayPaymentsAggView).concurrently()
                } catch (e) {
                    console.log("db.refreshMaterializedView failed", e)
                }
            }
        }
        loopFill()
    }
    fillUp()
}

try {
    indexer();
} catch (error) {
    if (error instanceof Error) {
        console.error('An error occurred while running the indexer:', error.message);
        console.error('Stack trace:', error.stack);
    } else {
        console.error('An unknown error occurred while running the indexer:', error);
    }
}