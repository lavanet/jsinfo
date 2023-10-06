import { StargateClient, IndexedTx, Block } from "@cosmjs/stargate"
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

import { EventProviderReported, ParseEventProviderReported } from "./events/EventProviderReported"

export type LavaBlock = {
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
    providerReportedEvts: EventProviderReported[]
}

export const GetOneLavaBlock = async (height: number, client: StargateClient): Promise<LavaBlock> => {
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
            throw('block!.header == undefined')
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
            throw('txs.length == 0 && block!.txs.length != 0')
        }
        writeFileSync(pathTxs, JSON.stringify(txs, null, 0), 'utf-8')
    }

    //
    // Block object to return
    const lavaBlock: LavaBlock = {
        height: height,
        datetime: Date.parse(block!.header.time),
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
        providerReportedEvts: [],
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
                case 'lava_provider_reported':
                    lavaBlock.providerReportedEvts.push(ParseEventProviderReported(evt))
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
                case 'lava_conflict_vote_got_reveal':
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