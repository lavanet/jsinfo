//
//
//

import { StargateClient, IndexedTx, Block } from "@cosmjs/stargate"
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, desc } from "drizzle-orm";
import * as schema from './schema';
import Database from 'better-sqlite3';
import * as lavajs from '@lavanet/lavajs';
import { PromisePool } from '@supercharge/promise-pool'
import { writeFileSync, readFileSync } from 'fs';

import { EventRelayPayment, ParseEventRelayPayment } from "./events/EventRelayPayment"
import { EventStakeUpdateProvider, ParseEventStakeUpdateProvider } from "./events/EventStakeUpdateProvider"
import { EventStakeNewProvider, ParseEventStakeNewProvider } from "./events/EventStakeNewProvider"
import { EventProviderUnstakeCommit, ParseEventProviderUnstakeCommit } from "./events/EventProviderUnstakeCommit"
import { EventFreezeProvider, ParseEventFreezeProvider } from "./events/EventFreezeProvider"
import { EventUnfreezeProvider, ParseEventUnfreezeProvider } from "./events/EventUnfreezeProvider"
import { EventBuySubscription, ParseEventBuySubscription } from "./events/EventBuySubscription"
import { EventAddProjectToSubscription, ParseEventAddProjectToSubscription } from "./events/EventAddProjectToSubscription"
import { EventDelKeyFromProject, ParseEventDelKeyFromProject } from "./events/EventDelKeyFromProject"
import { EventDelProjectToSubscription, ParseEventDelProjectToSubscription } from "./events/EventDelProjectToSubscription"
import { EventAddKeyToProject, ParseEventAddKeyToProject } from "./events/EventAddKeyToProject"
import { EventConflictVoteGotCommit, ParseEventConflictVoteGotCommit } from "./events/EventConflictVoteGotCommit"
import { EventResponseConflictDetection, ParseEventResponseConflictDetection } from "./events/EventResponseConflictDetection"
import { EventConflictDetectionReceived, ParseEventConflictDetectionReceived } from "./events/EventConflictDetectionReceived"
import { queryserver } from "./query";

const rpc = "https://public-rpc-testnet2.lavanet.xyz/"
const lava_testnet2_start_height = 340778;

enum EventType {
    StakeNewProvider = 1,
    StakeUpdateProvider,
    ProviderUnstakeCommit,
    FreezeProvider,
    UnfreezeProvider,
}

type LavaBlock = {
    height: number
    datetime: number,
    relayPaymentEvts: EventRelayPayment[]
    stakeNewProviderEvts: EventStakeNewProvider[]
    stakeUpdateProviderEvts: EventStakeUpdateProvider[]
    providerUnstakeCommitEvts: EventProviderUnstakeCommit[]
    freezeProviderEvts: EventFreezeProvider[]
    unfreezeProviderEvts: EventUnfreezeProvider[]
    buySubscriptionEvts: EventBuySubscription[]
    addProjectToSubscriptionEvts: EventAddProjectToSubscription[]
    delKeyFromProjectEvts: EventDelKeyFromProject[]
    delProjectToSubscriptionEvts: EventDelProjectToSubscription[]
    addKeyToProjectEvts: EventAddKeyToProject[]
    conflictVoteGotCommitEvts: EventConflictVoteGotCommit[]
    responseConflictDetectionEvts: EventResponseConflictDetection[]
    conflictDetectionReceivedEvts: EventConflictDetectionReceived[]
}

const GetOneBlock = async (height: number, client: StargateClient): Promise<LavaBlock> => {
    //
    // Get block (mostly for date)
    const pathBlocks = `./static/${height.toString()}.json`
    let block: Block;
    try {
        block = JSON.parse(readFileSync(pathBlocks, 'utf-8')) as Block
    }
    catch {
        block = await client.getBlock(height)
        writeFileSync(pathBlocks, JSON.stringify(block, null, 0), 'utf-8')
    }

    //
    // Get Txs for block
    const pathTxs = `./static/${height.toString()}_txs.json`
    let txs: IndexedTx[] = []
    try {
        txs = JSON.parse(readFileSync(pathTxs, 'utf-8')) as IndexedTx[]
    }
    catch {
        txs = await client.searchTx('tx.height=' + height);
        writeFileSync(pathTxs, JSON.stringify(txs, null, 0), 'utf-8')
    }

    //
    // Block object to return
    const lavaBlock: LavaBlock = {
        height: height,
        datetime: Math.trunc(Date.parse(block.header.time) / 1000),
        relayPaymentEvts: [],
        stakeNewProviderEvts: [],
        stakeUpdateProviderEvts: [],
        providerUnstakeCommitEvts: [],
        freezeProviderEvts: [],
        unfreezeProviderEvts: [],
        buySubscriptionEvts: [],
        addProjectToSubscriptionEvts: [],
        delKeyFromProjectEvts: [],
        delProjectToSubscriptionEvts: [],
        addKeyToProjectEvts: [],
        conflictVoteGotCommitEvts: [],
        responseConflictDetectionEvts: [],
        conflictDetectionReceivedEvts: [],
    }

    //
    // Loop over txs in block
    txs.forEach((tx) => {
        //
        // Pass on failed txs
        if (tx.code != 0) {
            return;
        }
        tx.events.forEach((evt) => {
            switch (evt.type) {
                //
                // Providers
                case 'lava_relay_payment':
                    lavaBlock.relayPaymentEvts.push(ParseEventRelayPayment(evt));
                    break;
                case 'lava_stake_new_provider':
                    lavaBlock.stakeNewProviderEvts.push(ParseEventStakeNewProvider(evt))
                    break
                case 'lava_stake_update_provider':
                    lavaBlock.stakeUpdateProviderEvts.push(ParseEventStakeUpdateProvider(evt))
                    break
                case 'lava_provider_unstake_commit':
                    lavaBlock.providerUnstakeCommitEvts.push(ParseEventProviderUnstakeCommit(evt))
                    break
                case 'lava_freeze_provider':
                    lavaBlock.freezeProviderEvts.push(ParseEventFreezeProvider(evt))
                    break
                case 'lava_unfreeze_provider':
                    lavaBlock.unfreezeProviderEvts.push(ParseEventUnfreezeProvider(evt))
                    break

                //
                // Subscription
                case 'lava_buy_subscription_event':
                    lavaBlock.buySubscriptionEvts.push(ParseEventBuySubscription(evt));
                    break
                case 'lava_add_project_to_subscription_event':
                    lavaBlock.addProjectToSubscriptionEvts.push(ParseEventAddProjectToSubscription(evt));
                    break
                case 'lava_del_project_to_subscription_event':
                    lavaBlock.delProjectToSubscriptionEvts.push(ParseEventDelProjectToSubscription(evt));
                    break
                case 'lava_del_key_from_project_event':
                    lavaBlock.delKeyFromProjectEvts.push(ParseEventDelKeyFromProject(evt));
                    break
                case 'lava_add_key_to_project_event':
                    lavaBlock.addKeyToProjectEvts.push(ParseEventAddKeyToProject(evt));
                    break

                //
                // Conflict
                case 'lava_conflict_vote_got_commit':
                    lavaBlock.conflictVoteGotCommitEvts.push(ParseEventConflictVoteGotCommit(evt));
                    break
                case 'lava_response_conflict_detection':
                    lavaBlock.responseConflictDetectionEvts.push(ParseEventResponseConflictDetection(evt));
                    break
                case 'lava_conflict_detection_received':
                    lavaBlock.conflictDetectionReceivedEvts.push(ParseEventConflictDetectionReceived(evt));
                    break

                case 'submit_proposal':
                case 'proposal_deposit':
                case 'proposal_vote':
                    break;

                case 'coin_received':
                case 'coinbase':
                case 'coin_spent':
                case 'coin_received':
                case 'transfer':
                case 'message':
                case 'tx':
                case 'withdraw_rewards':
                case 'withdraw_commission':
                case 'delegate':
                case 'redelegate':
                case 'create_validator':
                case 'edit_validator':
                    break;

                default:
                    console.log(height, evt.type)
                    break
            }
        })
    });

    return lavaBlock;
}

function getOrSetProvider(
    dbProviders: Map<string, schema.Provider>,
    static_dbProviders: Map<string, schema.Provider> | null,
    address: string,
    moniker: string
): schema.Provider {
    if (static_dbProviders != null) {
        let staticProvider = static_dbProviders.get(address);
        if (staticProvider != undefined) {
            return staticProvider
        }
    }

    let provider = dbProviders.get(address);
    if ((provider != undefined) && ((provider.moniker != '') || ((provider.moniker == '') && (moniker == '')))) {
        return provider
    }

    provider = {
        address: address,
        moniker: moniker,
    } as schema.Provider
    dbProviders.set(address, provider)
    return provider
}

function getOrSetSpec(
    dbSpecs: Map<string, schema.Spec>,
    static_dbSpecs: Map<string, schema.Spec> | null,
    specS: string
): schema.Spec {
    if (static_dbSpecs != null) {
        let staticSpec = static_dbSpecs.get(specS);
        if (staticSpec != undefined) {
            return staticSpec
        }
    }

    let spec = dbSpecs.get(specS);
    if (spec != undefined) {
        return spec
    }

    spec = {
        id: specS
    } as schema.Spec
    dbSpecs.set(specS, spec)
    return spec
}

function getOrSetConsumer(
    dbConsumers: Map<string, schema.Consumer>,
    address: string
): schema.Consumer {
    let dbConsumer = dbConsumers.get(address);
    if (dbConsumer != undefined) {
        return dbConsumer
    }

    dbConsumer = {
        address: address
    } as schema.Consumer
    dbConsumers.set(address, dbConsumer)
    return dbConsumer
}

function getOrSetPlan(
    dbPlans: Map<string, schema.Plan>,
    static_dbPlans: Map<string, schema.Plan> | null,
    planId: string
): schema.Plan {
    if (static_dbPlans != null) {
        let staticPlan = static_dbPlans.get(planId);
        if (staticPlan != undefined) {
            return staticPlan
        }
    }

    let dbPlan = dbPlans.get(planId);
    if (dbPlan != undefined) {
        return dbPlan
    }

    dbPlan = {
        id: planId
    } as schema.Plan
    dbPlans.set(planId, dbPlan)
    return dbPlan
}


async function getLatestProvidersAndSpecs(
    dbProviders: Map<string, schema.Provider>,
    dbSpecs: Map<string, schema.Spec>
) {
    const client = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc })
    const lavaClient = client.lavanet.lava;

    let specs = await lavaClient.spec.showAllChains()
    await Promise.all(specs.chainInfoList.map(async (spec) => {
        getOrSetSpec(dbSpecs, null, spec.chainID)

        let providers = await lavaClient.pairing.providers({ chainID: spec.chainID, showFrozen: true })
        providers.stakeEntry.forEach((providerStake) => {
            getOrSetProvider(dbProviders, null, providerStake.address, providerStake.moniker)
        })
    }))
}

async function getLatestPlans(dbPlans: Map<string, schema.Plan>) {
    const client = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc })
    const lavaClient = client.lavanet.lava;

    let plans = await lavaClient.plans.list()
    plans.plansInfo.forEach((plan) => {
        dbPlans.set(plan.index, {
            desc: plan.description,
            id: plan.index,
            price: parseInt(plan.price.amount),
        } as schema.Plan)
    })
}


async function InsertBlock(
    block: LavaBlock,
    db: BetterSQLite3Database,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>
) {
    //
    // Is in DB already?
    const dbBlock = await db.select().from(schema.blocks).where(eq(schema.blocks.height, block.height));
    if (dbBlock.length != 0) {
        return
    }

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
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, evt.moniker)
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.spec)

        dbProviderStakes.push({
            appliedHeight: evt.stakeAppliedBlock,
            blockId: block?.height,
            provider: evt.provider,
            specId: evt.spec
        } as schema.InsertProviderStake)
        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.StakeNewProvider,
            provider: evt.provider,
        } as schema.InsertEvent)
    })
    block.stakeUpdateProviderEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, evt.moniker)
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.spec)

        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.StakeUpdateProvider,
            provider: evt.provider
        } as schema.InsertEvent)
    })
    block.providerUnstakeCommitEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.address, evt.moniker)
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)

        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.ProviderUnstakeCommit,
            provider: evt.address
        } as schema.InsertEvent)
    })

    //
    // Freeze related
    block.freezeProviderEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.providerAddress, '')
        evt.chainIDs.forEach((specId) => {
            getOrSetSpec(dbSpecs, static_dbSpecs, specId)
        })

        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.FreezeProvider,
            provider: evt.providerAddress
        } as schema.InsertEvent)
    })
    block.unfreezeProviderEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.providerAddress, '')
        evt.chainIDs.forEach((specId) => {
            getOrSetSpec(dbSpecs, static_dbSpecs, specId)
        })

        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.UnfreezeProvider,
            provider: evt.providerAddress
        } as schema.InsertEvent)
    })

    //
    // Payment related
    block.relayPaymentEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, '')
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)
        getOrSetConsumer(dbConsumers, evt.client)

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
        getOrSetConsumer(dbConsumers, evt.consumer)
        getOrSetPlan(dbPlans, static_dbPlans, evt.plan)

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
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)
        getOrSetConsumer(dbConsumers, evt.client)

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
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, '')

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


async function latestBlockMeta(
    db: BetterSQLite3Database,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>
) {
    await getLatestProvidersAndSpecs(static_dbProviders, static_dbSpecs)
    await getLatestPlans(static_dbPlans)
    await db.transaction(async (tx) => {
        //
        // Insert all specs
        const arrSpecs = Array.from(static_dbSpecs.values())
        if (arrSpecs.length > 0) {
            await tx.insert(schema.specs)
                .values(arrSpecs)
                .onConflictDoNothing();
        }

        //
        // Find our create all providers
        const arrProviders = Array.from(static_dbProviders.values())
        if (arrProviders.length > 0) {
            await tx.insert(schema.providers)
                .values(arrProviders)
                .onConflictDoNothing();
        }

        //
        // Find our create all plans
        const arrPlans = Array.from(static_dbPlans.values())
        if (arrPlans.length > 0) {
            await tx.insert(schema.plans)
                .values(arrPlans)
                .onConflictDoNothing();
        }
    })
}

const indexer = async (): Promise<void> => {
    //
    // Client
    const client = await StargateClient.connect(rpc)
    const chainId = await client.getChainId()
    const height = await client.getHeight()
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
    await latestBlockMeta(db, static_dbProviders, static_dbSpecs, static_dbPlans) // TODO: do this every new block?

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
                    let block: null | LavaBlock = null;
                    block = await GetOneBlock(height, client)
                    if (block != null) {
                        await InsertBlock(block, db, static_dbProviders, static_dbSpecs, static_dbPlans)
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

const main = async (): Promise<void> => {
    if (process.argv.length != 3) {
        console.log('bad arguments')
        return
    }
    switch (process.argv[2]) {
        case 'indexer':
            indexer()
            break
        case 'queryserver':
            queryserver()
            break
        default:
            console.log('(2) bad arguments')
            return
    }
    return
}

main()