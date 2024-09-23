// src/indexer/eventProcessor.ts

import { Event } from "@cosmjs/stargate"

import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';

import { LavaBlock } from './types';

// Subscription Events
import { ParseEventBuySubscription } from "./events/EventBuySubscription";
import { ParseEventAddProjectToSubscription } from "./events/EventAddProjectToSubscription";
import { ParseEventDelProjectToSubscription } from "./events/EventDelProjectToSubscription";
import { ParseEventDelKeyFromProject } from "./events/EventDelKeyFromProject";
import { ParseEventAddKeyToProject } from "./events/EventAddKeyToProject";
import { ParseEventExpireSubscrption } from "./events/EventExpireSubscription";
import { ParseEventSetSubscriptionPolicyEvent } from "./events/EventSetSubscriptionPolicyEvent";

// Provider Events
import { ParseEventRelayPayment } from "./events/EventRelayPayment";
import { ParseEventStakeNewProvider } from "./events/EventStakeNewProvider";
import { ParseEventStakeUpdateProvider } from "./events/EventStakeUpdateProvider";
import { ParseEventProviderUnstakeCommit } from "./events/EventProviderUnstakeCommit";
import { ParseEventFreezeProvider } from "./events/EventFreezeProvider";
import { ParseEventUnfreezeProvider } from "./events/EventUnfreezeProvider";
import { ParseEventProviderReported } from "./events/EventProviderReported";
import { ParseEventProviderJailed } from "./events/EventProviderJailed";
import { ParseEventProviderTemporaryJailed } from "./events/EventProviderTemporaryJailed";
import { ParseEventProviderLatestBlockReport } from "./events/EventProviderLatestBlockReport";

// Conflict Events
import { ParseEventConflictVoteGotCommit } from "./events/EventConflictVoteGotCommit";
import { ParseEventResponseConflictDetection } from "./events/EventResponseConflictDetection";
import { ParseEventConflictDetectionReceived } from "./events/EventConflictDetectionReceived";
import { ParseEventConflictVoteGotReveal } from "./events/EventConflictVoteGotReveal";
import { ParseEventConflictVoteRevealStarted } from "./events/EventConflictVoteRevealStarted";
import { ParseEventConflictDetectionVoteResolved } from "./events/EventConflictDetectionVoteResolved";
import { ParseEventConflictDetectionVoteUnresolved } from "./events/EventConflictDetectionVoteUnresolved";

// Rewards Events
import { ParseEventProviderBonusRewards } from "./events/EventProviderBonusRewards";
import { ParseEventIPRPCPoolEmission } from "./events/EventIPRPCPoolEmmission";

// Dual Staking Events
import { ParseEventDelegateToProvider } from "./events/EventDelegateToProvider";
import { ParseEventUbondFromProvider } from "./events/EventUnbondFromProvider";
import { ParseEventRedelegateBetweenProviders } from "./events/EventRedelegateBetweenProviders";
import { ParseEventLavaFreezeFromUnbound } from "./events/EventFreezeFromUnbond";
import { ParseEventUnstakeFromUnbound } from "./events/EventUnstakeFromUnbound";
import { ParseEventValidatorSlash } from "./events/EventValidatorSlash";
import { ParseEventDelegatorClaimRewards } from "./events/EventDelegatorClaimRewards";

// Unidentified Event
import { ParseEventUnidentified } from "./events/EventUnidentified";
import { ParseEventDistributionPoolsRefill } from "./events/EventDistributionPoolsRefill";
import { logger } from "../utils/utils";

export const ProcessOneEvent = (
    evt: Event,
    lavaBlock: LavaBlock,
    height: number,
    txHash: string | null,


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {

    if (height > Number.MAX_SAFE_INTEGER) {
        throw new Error(`ProcessOneEvent: block height is larger than the maximum safe integer: ${height}`);
    }

    const evt_name = evt.type.startsWith('/') ? evt.type.substring(1) : evt.type

    switch (evt_name) {
        //
        // Providers
        // https://github.com/lavanet/lava/blob/main/x/pairing/types/types.go#L8
        /*
            These events are in the code but did not appear onchain yet:
            LatestBlocksReportEventName = "provider_latest_block_report"
            RejectedCuEventName         = "rejected_cu"
            UnstakeProposalEventName    = "unstake_gov_proposal"
        */
        // a successful relay payment
        case 'lava_relay_payment':
            ParseEventRelayPayment(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_stake_new_provider':
            ParseEventStakeNewProvider(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        // a successful provider stake entry modification
        case 'lava_stake_update_provider':
            ParseEventStakeUpdateProvider(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        // a successful provider stake entry modification
        case 'lava_provider_unstake_commit':
            ParseEventProviderUnstakeCommit(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        // freeze a provider in multiple chains
        case 'lava_freeze_provider':
            ParseEventFreezeProvider(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        // unfreeze a provider in multiple chains 
        case 'lava_unfreeze_provider':
            ParseEventUnfreezeProvider(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        // a successful provider report for unresponsiveness
        case 'lava_provider_reported':
            ParseEventProviderReported(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_provider_jailed':
            ParseEventProviderJailed(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_provider_temporary_jailed':
            ParseEventProviderTemporaryJailed(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        // a successful report of latest block of a provider per chain
        case 'lava_provider_latest_block_report':
            ParseEventProviderLatestBlockReport(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        //
        // Subscription
        // https://github.com/lavanet/lava/blob/main/x/subscription/types/types.go#L5
        /*
            These events are in the code but did not appear onchain yet:
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
            ParseEventBuySubscription(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_add_project_to_subscription_event':
            ParseEventAddProjectToSubscription(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_del_project_to_subscription_event':
            ParseEventDelProjectToSubscription(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_expire_subscription_event':
            ParseEventExpireSubscrption(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break
        case 'lava_set_subscription_policy_event':
            ParseEventSetSubscriptionPolicyEvent(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break


        // 
        // Project events
        // https://github.com/lavanet/lava/blob/main/x/projects/types/types.go#L19
        /*
            AddProjectKeyEventName         = "add_key_to_project_event"
            DelProjectKeyEventName         = "del_key_from_project_event"
            SetAdminPolicyEventName        = "set_admin_policy_event"
            SetSubscriptionPolicyEventName = "set_subscription_policy_event"
            ProjectResetFailEventName      = "project_reset_failed"
        */

        // a successful addition of a project key
        case 'lava_add_key_to_project_event':
            ParseEventAddKeyToProject(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // a successful deletion of a project key 
        case 'lava_del_key_from_project_event':
            ParseEventDelKeyFromProject(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // case 'lava_set_subscription_policy_event':
        //     // TODO - maybe?
        //     break


        //
        // Conflict
        // https://github.com/lavanet/lava/blob/main/x/conflict/types/types.go#L28
        //

        // sealed vote by provider
        case 'lava_conflict_vote_got_commit':
            ParseEventConflictVoteGotCommit(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // consumer sent 2 conflicting proofs, start conflict resolution
        // A new conflict has been opened, which involves all of the jury providers. It is now entering the commit stage
        case 'lava_response_conflict_detection':
            ParseEventResponseConflictDetection(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // redundant
        case 'lava_conflict_detection_received':
            ParseEventConflictDetectionReceived(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // provider revealed his vote
        case 'lava_conflict_vote_got_reveal':
            ParseEventConflictVoteGotReveal(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // conflict has transitioned to reveal state
        case 'lava_conflict_vote_reveal_started':
            ParseEventConflictVoteRevealStarted(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // conflict was succesfully resolved
        case 'lava_conflict_detection_vote_resolved':
            ParseEventConflictDetectionVoteResolved(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // conflict was not resolved (did not reach majority)
        // ConflictVoteUnresolvedEventName = "conflict_detection_vote_unresolved"
        case 'lava_conflict_detection_vote_unresolved':
            ParseEventConflictDetectionVoteUnresolved(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // // provider was unstaked due to conflict
        // case 'conflict_unstake_fraud_voter':
        //     // not used in the code
        //     break

        //
        // Dual stacking
        // https://github.com/lavanet/lava/blob/main/x/dualstaking/types/types.go#L4
        //

        // a successful provider delegation
        case 'lava_delegate_to_provider':
            // this is the only event i saw on chain
            ParseEventDelegateToProvider(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // a successful provider delegation unbond
        case 'lava_unbond_from_provider':
            ParseEventUbondFromProvider(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // // a successful provider redelegation
        case 'lava_redelegate_between_providers':
            ParseEventRedelegateBetweenProviders(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // // a successful provider delegator reward claim
        case 'lava_delegator_claim_rewards':
            ParseEventDelegatorClaimRewards(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)

        // // spec contributor got new rewards
        // case 'lava_contributor_rewards':
        //     break

        // validator slashed happened, providers slashed accordingly
        case 'lava_validator_slash':
            ParseEventValidatorSlash(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        case 'lava_freeze_from_unbond':
            ParseEventLavaFreezeFromUnbound(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        case 'lava_unstake_from_unbond':
            ParseEventUnstakeFromUnbound(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        //
        // Rewards
        // https://github.com/lavanet/lava/blob/main/x/rewards/types/types.go#L29
        //

        case "lava_provider_bonus_rewards":
            ParseEventProviderBonusRewards(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // a successful distribution of IPRPC bonus rewards
        case "lava_iprpc-pool-emmission":
        case "lava_iprpc_pool_emmission":
            ParseEventIPRPCPoolEmission(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        // a successful distribution rewards pools refill     
        case "lava_distribution_pools_refill":
            ParseEventDistributionPoolsRefill(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            break

        //
        // Epoc storage
        // these contain epoc information and block numbers
        // https://github.com/lavanet/lava/blob/main/x/epochstorage/types/types.go
        //

        case 'lava_new_epoch':
        case 'lava_earliest_epoch':
        case 'lava_fixated_params_change':
        case 'lava_fixated_params_clean':
            break

        //
        // Sepc storage
        // these contain spec updates
        // https://github.com/lavanet/lava/blob/main/x/spec/types/types.go#L16
        //

        case 'lava_param_change':
        case 'lava_spec_add':
        case 'lava_spec_refresh':
        case 'lava_spec_modify':
            break

        //
        // Cosmos Events
        // commision and rewards have ulava values in them but they are ignored
        //

        case 'update_client':
        case 'denomination_trace':
        case 'fungible_token_packet':
        case 'write_acknowledgement':
        case 'recv_packet':

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

        // new events added on 22/07/2024
        case 'use_feegrant':
        case 'update_feegrant':
            break

        // new events added on 02/08/2024
        case 'cosmos.authz.v1beta1.EventGrant':
        case 'cosmos.authz.v1beta1.MsgGrant':
        case 'set_withdraw_address':
            break

        case 'acknowledge_packet':
        case 'ibc_transfer':
        case 'send_packet':
            break

        default:
            ParseEventUnidentified(evt, height, txHash, lavaBlock, blockchainEntitiesStakes)
            logger.error(`ProcessOneEvent: Unknown event detected at height ${height} with event type ${evt.type} and event details:`, evt);
            break
    }
}