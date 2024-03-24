import { StargateClient, IndexedTx, Block, Event } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { writeFileSync, readFileSync } from 'fs';
import { ParseEventRelayPayment } from "./events/EventRelayPayment";
import { ParseEventStakeUpdateProvider } from "./events/EventStakeUpdateProvider";
import { ParseEventStakeNewProvider } from "./events/EventStakeNewProvider";
import { ParseEventProviderUnstakeCommit } from "./events/EventProviderUnstakeCommit";
import { ParseEventFreezeProvider } from "./events/EventFreezeProvider";
import { ParseEventUnfreezeProvider } from "./events/EventUnfreezeProvider";
import { ParseEventBuySubscription } from "./events/EventBuySubscription";
import { ParseEventAddProjectToSubscription } from "./events/EventAddProjectToSubscription";
import { ParseEventDelKeyFromProject } from "./events/EventDelKeyFromProject";
import { ParseEventDelProjectToSubscription } from "./events/EventDelProjectToSubscription";
import { ParseEventAddKeyToProject } from "./events/EventAddKeyToProject";
import { ParseEventConflictVoteGotCommit } from "./events/EventConflictVoteGotCommit";
import { ParseEventResponseConflictDetection } from "./events/EventResponseConflictDetection";
import { ParseEventConflictDetectionReceived } from "./events/EventConflictDetectionReceived";
import { ParseEventProviderReported } from "./events/EventProviderReported";
import { ParseEventProviderJailed } from "./events/EventProviderJailed";
import { ParseEventConflictVoteGotReveal } from "./events/EventConflictVoteGotReveal";
import { ParseEventConflictVoteRevealStarted } from "./events/EventConflictVoteRevealStarted";
import { ParseEventConflictDetectionVoteResolved } from "./events/EventConflictDetectionVoteResolved";
import { ParseEventConflictDetectionVoteUnresolved } from "./events/EventConflictDetectionVoteUnresolved";
import * as schema from '../schema';
import { GetEnvVar } from "../utils";

const JSINFO_IS_SAVE_CACHE = parseInt(GetEnvVar('JSINFO_INDEXER_SAVE_CACHE'));
const JSINFO_IS_READ_CACHE = parseInt(GetEnvVar('JSINFO_INDEXER_READ_CACHE'));
const JSINFO_INDEXER_CACHE_PATH = GetEnvVar('JSINFO_INDEXER_CACHE_PATH');

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
    const pathBlocks = `${JSINFO_INDEXER_CACHE_PATH}${height.toString()}.json`
    let block: Block;
    let excp = true

    if (JSINFO_IS_READ_CACHE) {
        try {
            excp = false
            block = JSON.parse(readFileSync(pathBlocks, 'utf-8')) as Block
        }
        catch {
            excp = true
        }
    }
    if (excp || block!.header == undefined) {
        block = await client.getBlock(height)
        if (block!.header == undefined) {
            throw ('block!.header == undefined')
        }
        if (JSINFO_IS_SAVE_CACHE) {
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
    const pathTxs = `${JSINFO_INDEXER_CACHE_PATH}${height.toString()}_txs.json`
    let txs: IndexedTx[] = []
    let excp = true

    if (JSINFO_IS_READ_CACHE) {
        try {
            excp = false
            txs = JSON.parse(readFileSync(pathTxs, 'utf-8')) as IndexedTx[]
        }
        catch {
            excp = true
        }
    }
    if (excp) {
        txs = await client.searchTx('tx.height=' + height)
        if (txs.length == 0 && block!.txs.length != 0) {
            throw ('txs.length == 0 && block!.txs.length != 0')
        }
        if (JSINFO_IS_SAVE_CACHE) {
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
    const pathTxs = `${JSINFO_INDEXER_CACHE_PATH}${height.toString()}_block_evts.json`
    let evts: Event[] = []
    let excp = true

    if (JSINFO_IS_READ_CACHE) {
        try {
            excp = false
            evts = JSON.parse(readFileSync(pathTxs, 'utf-8')) as Event[]
        }
        catch {
            excp = true
        }
    }
    if (excp) {
        const res = await client.blockResults(height)
        evts.push(...res.beginBlockEvents)
        evts.push(...res.endBlockEvents)
        if (res.height != height) {
            throw ('res.height != height')
        }
        if (JSINFO_IS_SAVE_CACHE) {
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
        // https://github.com/lavanet/lava/blob/main/x/pairing/types/types.go#L8
        /*
            TODO: add missing events:
            LatestBlocksReportEventName = "provider_latest_block_report"
            RejectedCuEventName         = "rejected_cu"
            UnstakeProposalEventName    = "unstake_gov_proposal"
        */
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
        case 'lava_provider_latest_block_report':
            // TODO
            break

        //
        // Subscription
        // https://github.com/lavanet/lava/blob/main/x/subscription/types/types.go#L5
        /*
            TODO: add missing events:
            AdvancedBuySubscriptionEventName        = "advanced_buy_subscription_event"
            AdvancedBuyUpgradeSubscriptionEventName = "advanced_buy_upgrade_subscription_event"
            SubscriptionAutoRenewChangeEventName    = "subscription_auto_renew_change_event"
            UpgradeSubscriptionEventName            = "upgrade_subscription_event"
            ExpireSubscriptionEventName             = "expire_subscription_event"
            AddTrackedCuEventName                   = "add_tracked_cu_event"
            MonthlyCuTrackerProviderRewardEventName = "monthly_cu_tracker_provider_reward"
            RemainingCreditEventName                = "subscription_remaining_credit"
        */
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
        // https://github.com/lavanet/lava/blob/main/x/conflict/types/types.go#L28
        //
        /*
            TODO: add missing events:
            ConflictUnstakeFraudVoterEventName = "conflict_unstake_fraud_voter"
        */
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

        //
        // Dual stacking
        // https://github.com/lavanet/lava/blob/main/x/dualstaking/types/types.go#L4
        //
        /*
            TODO: add missing events:
            ConflictUnstakeFraudVoterEventName = "conflict_unstake_fraud_voter"
        */
        // a successful provider delegation
        case 'lava_delegate_to_provider':
            // do this one
            break
        // a successful provider delegation unbond
        case 'lava_unbond_from_provider':
            // do this one
            break
        // a successful provider redelegation
        case 'lava_redelegate_between_providers':
            break
        // a successful provider delegator reward claim
        case 'lava_delegator_claim_rewards':
            break
        // spec contributor got new rewards
        case 'lava_contributor_rewards':
            break
        // validator slashed happened, providers slashed accordingly
        case 'lava_validator_slash':
            break
        case 'lava_freeze_from_unbond':
            break
        case 'lava_unstake_from_unbond':
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
        case 'complete_unbonding':
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
            console.log('processOneEvent:: Uknown event', height, evt.type, evt)
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

    const startTimeBlock = Date.now();
    const block = await getRpcBlock(height, client);
    const endTimeBlock = Date.now();
    if (endTimeBlock - startTimeBlock > 30000) {
        console.log('getRpcBlock took', endTimeBlock - startTimeBlock, 'milliseconds. It returned', block, 'items at block height', height);
    }

    const startTimeTxs = Date.now();
    const txs = await getRpcTxs(height, client, block);
    const endTimeTxs = Date.now();
    if (endTimeTxs - startTimeTxs > 30000) {
        console.log('getRpcTxs took', endTimeTxs - startTimeTxs, 'milliseconds. It returned', txs.length, 'items at block height', height);
    }

    const startTimeEvts = Date.now();
    const evts = await getRpcBlockResultEvents(height, clientTm);
    const endTimeEvts = Date.now();
    if (endTimeEvts - startTimeEvts > 30000) {
        console.log('getRpcBlockResultEvents took', endTimeEvts - startTimeEvts, 'milliseconds. It returned', evts.length, 'items at block height', height);
    }

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