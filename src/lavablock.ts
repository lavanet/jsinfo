import { StargateClient, IndexedTx, Block, Event } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { writeFileSync, readFileSync } from 'fs';
import { ParseEventRelayPayment } from "./events/EventRelayPayment"
import { ParseEventStakeUpdateProvider } from "./events/EventStakeUpdateProvider"
import { ParseEventStakeNewProvider } from "./events/EventStakeNewProvider"
import { ParseEventProviderUnstakeCommit } from "./events/EventProviderUnstakeCommit"
import { ParseEventFreezeProvider } from "./events/EventFreezeProvider"
import { ParseEventUnfreezeProvider } from "./events/EventUnfreezeProvider"
import { ParseEventBuySubscription } from "./events/EventBuySubscription"
import { ParseEventAddProjectToSubscription } from "./events/EventAddProjectToSubscription"
import { ParseEventDelKeyFromProject } from "./events/EventDelKeyFromProject"
import { ParseEventDelProjectToSubscription } from "./events/EventDelProjectToSubscription"
import { ParseEventAddKeyToProject } from "./events/EventAddKeyToProject"
import { ParseEventConflictVoteGotCommit } from "./events/EventConflictVoteGotCommit"
import { ParseEventResponseConflictDetection } from "./events/EventResponseConflictDetection"
import { ParseEventConflictDetectionReceived } from "./events/EventConflictDetectionReceived"
import { ParseEventProviderReported } from "./events/EventProviderReported"
import { ParseEventProviderJailed } from "./events/EventProviderJailed";
import { ParseEventConflictVoteGotReveal } from "./events/EventConflictVoteGotReveal";
import { ParseEventConflictVoteRevealStarted } from "./events/EventConflictVoteRevealStarted";
import { ParseEventConflictDetectionVoteResolved } from "./events/EventConflictDetectionVoteResolved";
import { ParseEventConflictDetectionVoteUnresolved } from "./events/EventConflictDetectionVoteUnresolved";
import * as schema from './schema';

const is_save_cache = parseInt(process.env['SAVE_CACHE']!)

export type LavaBlock = {
    height: number
    datetime: number,

    dbProviders: Map<string, schema.Provider>
    dbSpecs: Map<string, schema.Spec>
    dbConsumers: Map<string, schema.Consumer>
    dbPlans: Map<string, schema.Plan>
    dbTxs: Map<string, schema.Tx>
    dbEvents: schema.InsertEvent[]
    dbPayments: schema.InsertRelayPayment[]
    dbConflictResponses: schema.InsertConflictResponse[]
    dbSubscriptionBuys: schema.InsertSubscriptionBuy[]
    dbConflictVote: schema.InsertConflictVote[]
    dbProviderReports: schema.InsertProviderReported[]
}

//
// Get block (mostly for date)
const getRpcBlock = async (
    height: number,
    client: StargateClient,
): Promise<Block> => {
    const pathBlocks = `./static/${height.toString()}.json`
    let block: Block;
    let excp = false
    try {
        excp = false
        block = JSON.parse(readFileSync(pathBlocks, 'utf-8')) as Block
    }
    catch {
        excp = true
    }
    if (excp || block!.header == undefined) {
        block = await client.getBlock(height)
        if (block!.header == undefined) {
            throw ('block!.header == undefined')
        }
        if (is_save_cache) {
            writeFileSync(pathBlocks, JSON.stringify(block, null, 0), 'utf-8')
        }
    }

    return block!
}

const getRpcTxs = async (
    height: number,
    client: StargateClient,
    block: Block,
): Promise<IndexedTx[]> => {
    //
    // Get Txs for block
    const pathTxs = `./static/${height.toString()}_txs.json`
    let txs: IndexedTx[] = []
    let excp = false
    try {
        excp = false
        txs = JSON.parse(readFileSync(pathTxs, 'utf-8')) as IndexedTx[]
    }
    catch {
        excp = true
    }
    if (excp) {
        txs = await client.searchTx('tx.height=' + height)
        if (txs.length == 0 && block!.txs.length != 0) {
            throw ('txs.length == 0 && block!.txs.length != 0')
        }
        if (is_save_cache) {
            writeFileSync(pathTxs, JSON.stringify(txs, null, 0), 'utf-8')
        }
    }

    return txs
}

const getRpcBlockResultEvents = async (
    height: number,
    client: Tendermint37Client
): Promise<Event[]> => {
    //
    // Get Begin/End block events
    const pathTxs = `./static/${height.toString()}_block_evts.json`
    let evts: Event[] = []
    let excp = false
    try {
        excp = false
        evts = JSON.parse(readFileSync(pathTxs, 'utf-8')) as Event[]
    }
    catch {
        excp = true
    }
    if (excp) {
        const res = await client.blockResults(height)
        evts.push(...res.beginBlockEvents)
        evts.push(...res.endBlockEvents)
        if (res.height != height) {
            throw ('res.height != height')
        }
        if (is_save_cache) {
            writeFileSync(pathTxs, JSON.stringify(evts, null, 0), 'utf-8')
        }
    }

    return evts
}

const processOneEvent = (
    evt: Event,
    lavaBlock: LavaBlock,
    height: number,
    txHash: string | null,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
    switch (evt.type) {
        //
        // Providers
        case 'lava_relay_payment':
            ParseEventRelayPayment(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_stake_new_provider':
            ParseEventStakeNewProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_stake_update_provider':
            ParseEventStakeUpdateProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_provider_unstake_commit':
            ParseEventProviderUnstakeCommit(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_freeze_provider':
            ParseEventFreezeProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_unfreeze_provider':
            ParseEventUnfreezeProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_provider_reported':
            ParseEventProviderReported(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_provider_jailed':
            ParseEventProviderJailed(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        //
        // Subscription
        case 'lava_buy_subscription_event':
            ParseEventBuySubscription(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_add_project_to_subscription_event':
            ParseEventAddProjectToSubscription(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_del_project_to_subscription_event':
            ParseEventDelProjectToSubscription(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_del_key_from_project_event':
            ParseEventDelKeyFromProject(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_add_key_to_project_event':
            ParseEventAddKeyToProject(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        //
        // Conflict
        case 'lava_conflict_vote_got_commit':
            // sealed vote by provider
            ParseEventConflictVoteGotCommit(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_response_conflict_detection':
            // consumer sent 2 conflicting proofs, start conflict resolution
            ParseEventResponseConflictDetection(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_conflict_detection_received':
            // redundant
            ParseEventConflictDetectionReceived(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_conflict_vote_got_reveal':
            ParseEventConflictVoteGotReveal(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_conflict_vote_reveal_started':
            ParseEventConflictVoteRevealStarted(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_conflict_detection_vote_resolved':
            ParseEventConflictDetectionVoteResolved(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_conflict_detection_vote_unresolved':
            ParseEventConflictDetectionVoteUnresolved(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        case 'lava_fixated_params_clean':
        case 'lava_new_epoch':
        case 'lava_earliest_epoch':
            break
        case 'lava_param_change':
        case 'lava_spec_refresh':
        case 'lava_spec_modify':
        case 'lava_spec_add':
            break

        case 'submit_proposal':
        case 'proposal_deposit':
        case 'proposal_vote':
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
        case 'unbond':
        case 'liveness':
        case 'mint':
        case 'burn':
        case 'slash':
        case 'commission':
        case 'rewards':
        case 'complete_redelegation':
        case 'active_proposal':
            break

        default:
            console.log('uknown event', height, evt.type)
            break
    }
}

export const GetOneLavaBlock = async (
    height: number,
    client: StargateClient,
    clientTm: Tendermint37Client,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
): Promise<LavaBlock> => {


    const block = await getRpcBlock(height, client)
    const txs = await getRpcTxs(height, client, block)
    const evts = await getRpcBlockResultEvents(height, clientTm)

    //
    // Block object to return
    const lavaBlock: LavaBlock = {
        height: height,
        datetime: Date.parse(block!.header.time),

        dbProviders: new Map(),
        dbSpecs: new Map(),
        dbConsumers: new Map(),
        dbPlans: new Map(),
        dbTxs: new Map(),
        dbEvents: [],
        dbPayments: [],
        dbConflictResponses: [],
        dbSubscriptionBuys: [],
        dbConflictVote: [],
        dbProviderReports: [],
    }

    //
    // Loop over txs in block
    txs.forEach((tx) => {
        //
        // Pass on failed txs
        if (tx.code != 0) {
            return;
        }

        tx.events.forEach((evt) => processOneEvent(
            evt,
            lavaBlock,
            height,
            tx.hash,
            static_dbProviders,
            static_dbSpecs,
            static_dbPlans,
            static_dbStakes
        ))
    });
    evts.forEach((evt) => processOneEvent(
        evt,
        lavaBlock,
        height,
        null,
        static_dbProviders,
        static_dbSpecs,
        static_dbPlans,
        static_dbStakes
    ))

    return lavaBlock;
}