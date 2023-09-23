import { StargateClient } from "@cosmjs/stargate"
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, desc } from "drizzle-orm";
import Database from 'better-sqlite3';
import * as lavajs from '@lavanet/lavajs';
import * as schema from './schema';
import { PromisePool } from '@supercharge/promise-pool'
import { LavaBlock, GetOneLavaBlock } from './lavablock'
import { UpdateLatestBlockMeta, GetOrSetConsumer, GetOrSetPlan, GetOrSetProvider, GetOrSetSpec } from './setlatest'

const rpc = "https://public-rpc-testnet2.lavanet.xyz/"
const lava_testnet2_start_height = 340778;


async function isBlockInDb(
    db: BetterSQLite3Database,
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
    db: BetterSQLite3Database,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>
) {
    //
    // Init
    let dbProviders: Map<string, schema.Provider> = new Map()
    let dbSpecs: Map<string, schema.Spec> = new Map()
    let dbConsumers: Map<string, schema.Consumer> = new Map()
    let dbPlans: Map<string, schema.Plan> = new Map()
    //
    let dbEvents: schema.InsertEvent[] = []
    let dbProviderStakes: schema.InsertProviderStake[] = []
    let dbPayments: schema.InsertRelayPayment[] = []
    let dbConflictResponses: schema.InsertConflictResponse[] = []
    let dbSubscriptionBuys: schema.InsertSubscriptionBuy[] = []
    let dbConflictVote: schema.InsertConflictVote[] = []

    //
    // Stake related
    block.stakeNewProviderEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.provider, evt.moniker)
        GetOrSetSpec(dbSpecs, static_dbSpecs, evt.spec)

        dbProviderStakes.push({
            appliedHeight: evt.stakeAppliedBlock,
            stake: evt.stake,
            blockId: block?.height,
            provider: evt.provider,
            specId: evt.spec
        } as schema.InsertProviderStake)
        dbEvents.push({
            blockId: block?.height,
            eventType: schema.LavaProviderEventType.StakeNewProvider,
            provider: evt.provider,
        } as schema.InsertEvent)
    })
    block.stakeUpdateProviderEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.provider, evt.moniker)
        GetOrSetSpec(dbSpecs, static_dbSpecs, evt.spec)

        dbEvents.push({
            blockId: block?.height,
            eventType: schema.LavaProviderEventType.StakeUpdateProvider,
            provider: evt.provider
        } as schema.InsertEvent)
    })
    block.providerUnstakeCommitEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.address, evt.moniker)
        GetOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)

        dbEvents.push({
            blockId: block?.height,
            eventType: schema.LavaProviderEventType.ProviderUnstakeCommit,
            provider: evt.address
        } as schema.InsertEvent)
    })

    //
    // Freeze related
    block.freezeProviderEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.providerAddress, '')
        evt.chainIDs.forEach((specId) => {
            GetOrSetSpec(dbSpecs, static_dbSpecs, specId)
        })

        dbEvents.push({
            blockId: block?.height,
            eventType: schema.LavaProviderEventType.FreezeProvider,
            provider: evt.providerAddress
        } as schema.InsertEvent)
    })
    block.unfreezeProviderEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.providerAddress, '')
        evt.chainIDs.forEach((specId) => {
            GetOrSetSpec(dbSpecs, static_dbSpecs, specId)
        })

        dbEvents.push({
            blockId: block?.height,
            eventType: schema.LavaProviderEventType.UnfreezeProvider,
            provider: evt.providerAddress
        } as schema.InsertEvent)
    })

    //
    // Payment related
    block.relayPaymentEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.provider, '')
        GetOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)
        GetOrSetConsumer(dbConsumers, evt.client)

        dbPayments.push({
            blockId: block?.height,
            specId: evt.chainID,
            provider: evt.provider,
            //
            cu: evt.CU,
            pay: evt.BasePay,
            qosAvailability: evt.QoSAvailability,
            qosLatency: evt.QoSLatency,
            qosSync: evt.QoSLatency,
            relays: evt.relayNumber,
            consumer: evt.client
        } as schema.InsertRelayPayment)
    })

    //
    // Plans / Subscriptions related
    block.buySubscriptionEvts.forEach((evt) => {
        GetOrSetConsumer(dbConsumers, evt.consumer)
        GetOrSetPlan(dbPlans, static_dbPlans, evt.plan)

        dbSubscriptionBuys.push({
            blockId: block?.height,
            consumer: evt.consumer,
            duration: evt.duration,
            plan: evt.plan,
        } as schema.InsertSubscriptionBuy)
    })

    //
    // Conflict related
    block.responseConflictDetectionEvts.forEach((evt) => {
        GetOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)
        GetOrSetConsumer(dbConsumers, evt.client)

        dbConflictResponses.push({
            blockId: block?.height,
            consumer: evt.client,

            apiInterface: evt.apiInterface,
            apiURL: evt.apiURL,
            connectionType: evt.connectionType,
            requestBlock: evt.requestBlock,
            requestData: evt.requestData,
            specId: evt.chainID,
            voteDeadline: evt.voteDeadline,
            voteId: evt.voteID,
        } as schema.InsertConflictResponse)
    })
    block.conflictVoteGotCommitEvts.forEach((evt) => {
        GetOrSetProvider(dbProviders, static_dbProviders, evt.provider, '')

        dbConflictVote.push({
            blockId: block?.height,
            provider: evt.provider,
            voteId: evt.voteID,
        } as schema.ConflictVote)
    })

    //
    // We use a transaction to revert insert on any errors
    await db.transaction(async (tx) => {

        //
        // First insert block
        if (block == null) {
            return
        }
        await tx.insert(schema.blocks).values({ height: block.height })

        //
        // Insert all specs
        const arrSpecs = Array.from(dbSpecs.values())
        if (arrSpecs.length > 0) {
            await tx.insert(schema.specs)
                .values(arrSpecs)
                .onConflictDoNothing();
        }

        //
        // Find / create all providers
        const arrProviders = Array.from(dbProviders.values())
        if (arrProviders.length > 0) {
            await tx.insert(schema.providers)
                .values(arrProviders)
                .onConflictDoNothing();
        }

        //
        // Find / create all plans
        const arrPlans = Array.from(dbPlans.values())
        if (arrPlans.length > 0) {
            await tx.insert(schema.plans)
                .values(arrPlans)
                .onConflictDoNothing();
        }

        //
        // Find / create all consumers
        const arrConsumers = Array.from(dbConsumers.values())
        if (arrConsumers.length > 0) {
            await tx.insert(schema.consumers)
                .values(arrConsumers)
                .onConflictDoNothing();
        }

        //
        // Create
        if (dbEvents.length > 0) {
            await tx.insert(schema.events).values(dbEvents)
        }
        if (dbPayments.length > 0) {
            await tx.insert(schema.relayPayments).values(dbPayments)
        }
        if (dbProviderStakes.length > 0) {
            await tx.insert(schema.providerStakes).values(dbProviderStakes)
        }
        if (dbConflictResponses.length > 0) {
            await tx.insert(schema.conflictResponses).values(dbConflictResponses)
        }
        if (dbSubscriptionBuys.length > 0) {
            await tx.insert(schema.subscriptionBuys).values(dbSubscriptionBuys)
        }
        if (dbConflictVote.length > 0) {
            await tx.insert(schema.conflictVotes).values(dbConflictVote)
        }
    })
}

const indexer = async (): Promise<void> => {
    //
    // Client
    const client = await StargateClient.connect(rpc)
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    const lavajsClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc })
    console.log('chain', chainId, 'current height', height)

    //
    // DB
    const sqlite = new Database('dev.db')
    const db: BetterSQLite3Database = drizzle(sqlite)
    await migrate(db, { migrationsFolder: "drizzle" })

    //
    // Insert providers, specs & plans from latest block 
    let static_dbProviders: Map<string, schema.Provider> = new Map()
    let static_dbSpecs: Map<string, schema.Spec> = new Map()
    let static_dbPlans: Map<string, schema.Plan> = new Map()
    await UpdateLatestBlockMeta(
        db,
        lavajsClient,
        static_dbProviders,
        static_dbSpecs,
        static_dbPlans
    ) // TODO: add this every block (when not catching up)

    //
    // Loop forever, filling up blocks
    const pollEvery = 1000 // ms
    const fillUp = async () => {
        //
        // Blockchain latest
        const latestHeight = await client.getHeight();

        //
        // Find latest block on DB
        let start_height = lava_testnet2_start_height
        const latestDbBlock = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
        if (latestDbBlock.length != 0) {
            const tHeight = latestDbBlock[0].height
            if (tHeight != null) {
                start_height = tHeight
            }
        }
        console.log('db height', start_height, 'blockchain height', latestHeight)

        //
        // Start filling up
        const batchSize = 250
        const concurrentSize = 1
        const blockList = []
        for (let i = start_height; i <= latestHeight; i++) {
            blockList.push(i)
        }
        while (blockList.length > 0) {
            let start = performance.now();

            const tmpList = blockList.splice(0, batchSize);
            const { results, errors } = await PromisePool
                .withConcurrency(concurrentSize)
                .for(tmpList)
                .process(async (height) => {
                    if (await isBlockInDb(db, height)) {
                        return
                    }

                    let block: null | LavaBlock = null;
                    block = await GetOneLavaBlock(height, client)
                    if (block != null) {
                        await InsertBlock(block, db, static_dbProviders, static_dbSpecs, static_dbPlans)
                    } else {
                        console.log('failed getting block', height)
                    }
                })

            let timeTaken = performance.now() - start;
            console.log(errors, blockList.length / batchSize, 'time', timeTaken)
            //
            // Add errors to start of queue
            errors.forEach((err) => {
                blockList.unshift(err.item)
            })
        }
        setTimeout(fillUp, pollEvery)
    }
    fillUp()
}

indexer()
