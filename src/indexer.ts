import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, desc } from "drizzle-orm";
import * as lavajs from '@lavanet/lavajs';
import * as schema from './schema';
import { PromisePool } from '@supercharge/promise-pool'
import { LavaBlock, GetOneLavaBlock } from './lavablock'
import { UpdateLatestBlockMeta } from './setlatest'
import { MigrateDb, GetDb } from "./utils";

const rpc = process.env['LAVA_RPC'] as string
const n_workers = parseInt(process.env['N_WORKERS']!)
const batch_size = parseInt(process.env['BATCH_SIZE']!)
const poll_ms = parseInt(process.env['POLL_MS']!)
const lava_testnet2_start_height = parseInt(process.env['START_BLOCK']!) // 340778 has a weird date (9 months ago)
let static_dbProviders: Map<string, schema.Provider> = new Map()
let static_dbSpecs: Map<string, schema.Spec> = new Map()
let static_dbPlans: Map<string, schema.Plan> = new Map()
let static_dbStakes: Map<string, schema.ProviderStake[]> = new Map()

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
        if (arrSpecs.length > 0) {
            await tx.insert(schema.specs)
                .values(arrSpecs)
                .onConflictDoNothing();
        }
        
        // Insert all Txs
        const arrTxs = Array.from(block.dbTxs.values())
        if (arrTxs.length > 0) {
            await tx.insert(schema.txs)
                .values(arrTxs)
                .onConflictDoNothing();
        }
        // Find / create all providers
        const arrProviders = Array.from(block.dbProviders.values())
        if (arrProviders.length > 0) {
            await tx.insert(schema.providers)
                .values(arrProviders)
                .onConflictDoNothing();
        }
        // Find / create all plans
        const arrPlans = Array.from(block.dbPlans.values())
        if (arrPlans.length > 0) {
            await tx.insert(schema.plans)
                .values(arrPlans)
                .onConflictDoNothing();
        }
        // Find / create all consumers
        const arrConsumers = Array.from(block.dbConsumers.values())
        if (arrConsumers.length > 0) {
            await tx.insert(schema.consumers)
                .values(arrConsumers)
                .onConflictDoNothing();
        }
        // Create
        if (block.dbEvents.length > 0) {
            await tx.insert(schema.events).values(block.dbEvents)
        }
        if (block.dbPayments.length > 0) {
            await tx.insert(schema.relayPayments).values(block.dbPayments)
        }
        if (block.dbConflictResponses.length > 0) {
            await tx.insert(schema.conflictResponses).values(block.dbConflictResponses)
        }
        if (block.dbSubscriptionBuys.length > 0) {
            await tx.insert(schema.subscriptionBuys).values(block.dbSubscriptionBuys)
        }
        if (block.dbConflictVote.length > 0) {
            await tx.insert(schema.conflictVotes).values(block.dbConflictVote)
        }
        if (block.dbProviderReports.length > 0) {
            await tx.insert(schema.providerReported).values(block.dbProviderReports)
        }
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
    const blockList = []
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
                console.log(">>> DBG", "process", height, "start")


                if (await isBlockInDb(db, height)) {
                    return
                }

                console.log(">>> DBG", "process", height, "111")

                let block: null | LavaBlock = null;
                block = await GetOneLavaBlock(height, client, clientTm, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                console.log(">>> DBG", "process", height, "222")
                if (block != null) {
                    console.log(">>> DBG", "process", height, "333")
                    await InsertBlock(block, db)
                    console.log(">>> DBG", "process", height, "444")
                } else {
                    console.log('failed getting block', height)
                }
                console.log(">>> DBG", "process", height, "555")
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
        // Add errors to start of queue
        // TODO: delay the execution of this to the next iteration
        errors.forEach((err) => {
            blockList.unshift(err.item)
        })
    }
}

const indexer = async (): Promise<void> => {
    console.log(`starting indexer, rpc: ${rpc}, start height: ${lava_testnet2_start_height}`)
    //
    // Client
    const client = await StargateClient.connect(rpc)
    const clientTm = await Tendermint37Client.connect(rpc)
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    const lavajsClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc })
    console.log('chain', chainId, 'current height', height)

    //
    // DB
    await MigrateDb()
    const db = GetDb()

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
        console.log(">>> DBG", "fillUp")
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
        console.log(">>> DBG", "Find latest 1")
        let dbHeight = lava_testnet2_start_height
        let latestDbBlock
        try {
            latestDbBlock = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
        } catch (e) {
            console.log('failed getting latestDbBlock', e)
            loopFill()
            return
        }
        if (latestDbBlock.length != 0) {
            const tHeight = latestDbBlock[0].height
            if (tHeight != null) {
                dbHeight = tHeight
            }
        }
        console.log(">>> DBG", "Find latest 2")

        //
        // Found diff, start
        if (latestHeight > dbHeight) {
            console.log('db height', dbHeight, 'blockchain height', latestHeight)
            await doBatch(db, client, clientTm, dbHeight, latestHeight)
            console.log(">>> DBG", "doBatch done")

            //
            // Get the latest meta from RPC if not catching up
            // catching up = more than 1 block being indexed
            if (latestHeight - dbHeight == 1) {
                try {
                    console.log(">>> DBG", "UpdateLatestBlockMeta")
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
                    console.log(">>> DBG", "UpdateLatestBlockMeta done")
                } catch (e) {
                    console.log('UpdateLatestBlockMeta', e)
                }
                console.log(">>> DBG", "refreshMaterializedView")
                try {
                    await db.refreshMaterializedView(schema.relayPaymentsAggView).concurrently()
                } catch (e) {
                    console.log("db.refreshMaterializedView failed", e)
                }
                console.log(">>> DBG", "refreshMaterializedView done")
            }
        }
        loopFill()
    }
    fillUp()
}

indexer()
