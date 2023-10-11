import { StargateClient, IndexedTx, Block } from "@cosmjs/stargate"
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

import * as schema from './schema';

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

export const GetOneLavaBlock = async (
    height: number,
    client: StargateClient,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
): Promise<LavaBlock> => {
    //
    // Get block (mostly for date)
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
        writeFileSync(pathBlocks, JSON.stringify(block, null, 0), 'utf-8')
    }

    //
    // Get Txs for block
    const pathTxs = `./static/${height.toString()}_txs.json`
    let txs: IndexedTx[] = []
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
        writeFileSync(pathTxs, JSON.stringify(txs, null, 0), 'utf-8')
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

        tx.events.forEach((evt) => {
            switch (evt.type) {
                //
                // Providers
                case 'lava_relay_payment':
                    ParseEventRelayPayment(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break;
                case 'lava_stake_new_provider':
                    ParseEventStakeNewProvider(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_stake_update_provider':
                    ParseEventStakeUpdateProvider(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_provider_unstake_commit':
                    ParseEventProviderUnstakeCommit(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_freeze_provider':
                    ParseEventFreezeProvider(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_unfreeze_provider':
                    ParseEventUnfreezeProvider(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_provider_reported':
                    ParseEventProviderReported(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break

                //
                // Subscription
                case 'lava_buy_subscription_event':
                    ParseEventBuySubscription(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_add_project_to_subscription_event':
                    ParseEventAddProjectToSubscription(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_del_project_to_subscription_event':
                    ParseEventDelProjectToSubscription(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_del_key_from_project_event':
                    ParseEventDelKeyFromProject(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_add_key_to_project_event':
                    ParseEventAddKeyToProject(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break

                //
                // Conflict
                case 'lava_conflict_vote_got_commit':
                    ParseEventConflictVoteGotCommit(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_response_conflict_detection':
                    ParseEventResponseConflictDetection(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_conflict_detection_received':
                    ParseEventConflictDetectionReceived(evt, height, tx.hash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                    break
                case 'lava_conflict_vote_got_reveal':
                    console.log(height, evt)
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
                    break

                default:
                    console.log('uknown event', height, evt.type)
                    break
            }
        })
    });

    return lavaBlock;
}