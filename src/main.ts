//
//
//

import { StargateClient } from "@cosmjs/stargate"
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, desc } from "drizzle-orm";
import { Provider, Event, RelayPayment, InsertRelayPayment, blocks, providers, InsertEvent, events, relayPayments, Spec, specs, InsertProviderStake, providerStakes } from './schema';
import Database from 'better-sqlite3';
import * as lavajs from '@lavanet/lavajs';
import { PromisePool } from '@supercharge/promise-pool'


import { EventRelayPayment, ParseEventRelayPayment } from "./EventRelayPayment"
import { EventStakeUpdateProvider, ParseEventStakeUpdateProvider } from "./EventStakeUpdateProvider"
import { EventStakeNewProvider, ParseEventStakeNewProvider } from "./EventStakeNewProvider"
import { EventProviderUnstakeCommit, ParseEventProviderUnstakeCommit } from "./EventProviderUnstakeCommit"
import { EventFreezeProvider, ParseEventFreezeProvider } from "./EventFreezeProvider"
import { EventUnfreezeProvider, ParseEventUnfreezeProvider } from "./EventUnfreezeProvider"

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
    relayPaymentEvts: EventRelayPayment[]
    stakeNewProviderEvts: EventStakeNewProvider[]
    stakeUpdateProviderEvts: EventStakeUpdateProvider[]
    providerUnstakeCommitEvts: EventProviderUnstakeCommit[]
    freezeProviderEvts: EventFreezeProvider[]
    unfreezeProviderEvts: EventUnfreezeProvider[]
}

const GetOneBlock = async (height: number, client: StargateClient): Promise<LavaBlock> => {
    const lavaBlock: LavaBlock = {
        height: height,
        relayPaymentEvts: [],
        stakeNewProviderEvts: [],
        stakeUpdateProviderEvts: [],
        providerUnstakeCommitEvts: [],
        freezeProviderEvts: [],
        unfreezeProviderEvts: [],
    }

    const txs = await client.searchTx('tx.height=' + height);
    txs.forEach((tx) => {
        if (tx.code != 0) {
            return;
        }
        tx.events.forEach((evt) => {
            switch (evt.type) {
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

                case 'submit_proposal':
                case 'proposal_deposit':
                case 'proposal_vote':
                    break;

                case 'lava_buy_subscription_event':
                case 'lava_add_project_to_subscription_event':
                case 'lava_del_project_to_subscription_event':
                case 'lava_del_key_from_project_event':
                case 'lava_add_key_to_project_event':
                    break

                case 'lava_conflict_vote_got_commit':
                case 'lava_response_conflict_detection':
                case 'lava_conflict_detection_received':
                    break;

                default:
                    console.log(height, evt.type)
                    break
            }
        })
    });

    return lavaBlock;
}

function getOrSetProvider(dbProviders: Map<string, Provider>, static_dbProviders: Map<string, Provider> | null, address: string, moniker: string): Provider {
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
    } as Provider
    dbProviders.set(address, provider)
    return provider
}

function getOrSetSpec(dbSpecs: Map<string, Spec>, static_dbSpecs: Map<string, Spec> | null, specS: string): Spec {
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
    } as Spec
    dbSpecs.set(specS, spec)
    return spec
}

async function getLatestProviders(dbProviders: Map<string, Provider>, dbSpecs: Map<string, Spec>) {
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

async function InsertBlock(
    block: LavaBlock,
    db: BetterSQLite3Database,
    static_dbProviders: Map<string, Provider>,
    static_dbSpecs: Map<string, Spec>
) {
    //
    // Is in DB already?
    const dbBlock = await db.select().from(blocks).where(eq(blocks.height, block.height));
    if (dbBlock.length != 0) {
        return
    }

    //
    // Stake related
    let dbProviders: Map<string, Provider> = new Map()
    let dbSpecs: Map<string, Spec> = new Map()
    let dbEvents: InsertEvent[] = []
    let dbPayments: InsertRelayPayment[] = []
    let dbProviderStakes: InsertProviderStake[] = []
    block.stakeNewProviderEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, evt.moniker)
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.spec)

        dbProviderStakes.push({
            appliedHeight: evt.stakeAppliedBlock,
            blockId: block?.height,
            provider: evt.provider,
            specId: evt.spec
        } as InsertProviderStake)
        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.StakeNewProvider,
            provider: evt.provider,
        } as InsertEvent)
    })
    block.stakeUpdateProviderEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, evt.moniker)
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.spec)

        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.StakeUpdateProvider,
            provider: evt.provider
        } as InsertEvent)
    })
    block.providerUnstakeCommitEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.address, evt.moniker)
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)

        dbEvents.push({
            blockId: block?.height,
            eventType: EventType.ProviderUnstakeCommit,
            provider: evt.address
        } as InsertEvent)
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
        } as InsertEvent)
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
        } as InsertEvent)
    })

    //
    // Payment related
    block.relayPaymentEvts.forEach((evt) => {
        getOrSetProvider(dbProviders, static_dbProviders, evt.provider, '')
        getOrSetSpec(dbSpecs, static_dbSpecs, evt.chainID)

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
        } as InsertRelayPayment)
    })

    //
    // We use a transaction to revert insert on any errors
    await db.transaction(async (tx) => {

        //
        // First insert block
        if (block == null) {
            return
        }
        await tx.insert(blocks).values({ height: block.height })

        //
        // Insert all specs
        const arrSpecs = Array.from(dbSpecs.values())
        if (arrSpecs.length > 0) {
            await tx.insert(specs)
                .values(arrSpecs)
                .onConflictDoNothing();
        }

        //
        // Find our create all providers
        const arrProviders = Array.from(dbProviders.values())
        if (arrProviders.length > 0) {
            await tx.insert(providers)
                .values(arrProviders)
                .onConflictDoNothing();
        }

        //
        // Create all events
        if (dbEvents.length > 0) {
            await tx.insert(events).values(dbEvents)
        }

        //
        // Create all relay payments
        if (dbPayments.length > 0) {
            await tx.insert(relayPayments).values(dbPayments)
        }

        //
        // Create all provider stakes
        if (dbProviderStakes.length > 0) {
            await tx.insert(providerStakes).values(dbProviderStakes)
        }
    })
}

const main = async (): Promise<void> => {
    //
    // Client
    const client = await StargateClient.connect(rpc)
    const chainId = await client.getChainId();
    const height = await client.getHeight();
    console.log('chain', chainId, 'current height', height);

    //
    // DB
    const sqlite = new Database('dev.db');
    const db: BetterSQLite3Database = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "drizzle" });

    //
    // Insert providers & specs from latst block
    let static_dbProviders: Map<string, Provider> = new Map()
    let static_dbSpecs: Map<string, Spec> = new Map()
    await getLatestProviders(static_dbProviders, static_dbSpecs);
    await db.transaction(async (tx) => {
        //
        // Insert all specs
        const arrSpecs = Array.from(static_dbSpecs.values())
        if (arrSpecs.length > 0) {
            await tx.insert(specs)
                .values(arrSpecs)
                .onConflictDoNothing();
        }

        //
        // Find our create all providers
        const arrProviders = Array.from(static_dbProviders.values())
        if (arrProviders.length > 0) {
            await tx.insert(providers)
                .values(arrProviders)
                .onConflictDoNothing();
        }
    })

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
        const latestDbBlock = await db.select().from(blocks).orderBy(desc(blocks.height)).limit(1)
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
        const concurrentSize = 25
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
                        await InsertBlock(block, db, static_dbProviders, static_dbSpecs)
                    }
                })

            let timeTaken = performance.now() - start;
            console.log(errors, blockList.length / batchSize, 'time', timeTaken)
            //
            // Add errors back to queue
            errors.forEach((err) => {
                blockList.push(err.item)
            })
        }
        setTimeout(fillUp, pollEvery)
    }
    fillUp()
}

main()