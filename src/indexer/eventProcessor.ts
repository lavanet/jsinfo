import { Event } from "@cosmjs/stargate"

import * as schema from '../schema';

import { LavaBlock } from './types';

// Subscription Events
import { ParseEventBuySubscription } from "./events/EventBuySubscription";
import { ParseEventAddProjectToSubscription } from "./events/EventAddProjectToSubscription";
import { ParseEventDelProjectToSubscription } from "./events/EventDelProjectToSubscription";
import { ParseEventDelKeyFromProject } from "./events/EventDelKeyFromProject";
import { ParseEventAddKeyToProject } from "./events/EventAddKeyToProject";
import { ParseEventExpireSubscrption } from "./events/EventExpireSubscription";

// Provider Events
import { ParseEventRelayPayment } from "./events/EventRelayPayment";
import { ParseEventStakeNewProvider } from "./events/EventStakeNewProvider";
import { ParseEventStakeUpdateProvider } from "./events/EventStakeUpdateProvider";
import { ParseEventProviderUnstakeCommit } from "./events/EventProviderUnstakeCommit";
import { ParseEventFreezeProvider } from "./events/EventFreezeProvider";
import { ParseEventUnfreezeProvider } from "./events/EventUnfreezeProvider";
import { ParseEventProviderReported } from "./events/EventProviderReported";
import { ParseEventProviderJailed } from "./events/EventProviderJailed";

// Conflict Events
import { ParseEventConflictVoteGotCommit } from "./events/EventConflictVoteGotCommit";
import { ParseEventResponseConflictDetection } from "./events/EventResponseConflictDetection";
import { ParseEventConflictDetectionReceived } from "./events/EventConflictDetectionReceived";
import { ParseEventConflictVoteGotReveal } from "./events/EventConflictVoteGotReveal";
import { ParseEventConflictVoteRevealStarted } from "./events/EventConflictVoteRevealStarted";
import { ParseEventConflictDetectionVoteResolved } from "./events/EventConflictDetectionVoteResolved";
import { ParseEventConflictDetectionVoteUnresolved } from "./events/EventConflictDetectionVoteUnresolved";

// Dual Staking Events
import { ParseEventDelegateToProvider } from "./events/EventDelegateToProvider";
import { ParseEventUbondFromProvider } from "./events/EventUnbondFromProvider";
import { ParseEventRedelegateBetweenProviders } from "./events/EventRedelegateBetweenProviders";
import { ParseEventLavaFreezeFromUnbound } from "./events/EventFreezeFromUnbond";
import { ParseEventUnstakeFromUnbound } from "./events/EventUnstakeFromUnbound";

export const ProcessOneEvent = (
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
            These events are in the code but did not appear onchain yet:
            LatestBlocksReportEventName = "provider_latest_block_report"
            RejectedCuEventName         = "rejected_cu"
            UnstakeProposalEventName    = "unstake_gov_proposal"
        */
        // a successful relay payment
        case 'lava_relay_payment':
            ParseEventRelayPayment(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_stake_new_provider':
            ParseEventStakeNewProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        // a successful provider stake entry modification
        case 'lava_stake_update_provider':
            ParseEventStakeUpdateProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        // a successful provider stake entry modification
        case 'lava_provider_unstake_commit':
            ParseEventProviderUnstakeCommit(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        // freeze a provider in multiple chains
        case 'lava_freeze_provider':
            ParseEventFreezeProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        // unfreeze a provider in multiple chains 
        case 'lava_unfreeze_provider':
            ParseEventUnfreezeProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        // a successful provider report for unresponsiveness
        case 'lava_provider_reported':
            ParseEventProviderReported(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        case 'lava_provider_jailed':
            ParseEventProviderJailed(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break
        // a successful report of latest block of a provider 
        case 'lava_provider_latest_block_report':
            // don't store - this happens every block
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
        case 'lava_expire_subscription_event':
            ParseEventExpireSubscrption(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        //
        // Conflict
        // https://github.com/lavanet/lava/blob/main/x/conflict/types/types.go#L28
        //

        // sealed vote by provider
        case 'lava_conflict_vote_got_commit':
            ParseEventConflictVoteGotCommit(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // consumer sent 2 conflicting proofs, start conflict resolution
        // A new conflict has been opened, which involves all of the jury providers. It is now entering the commit stage
        case 'lava_response_conflict_detection':
            ParseEventResponseConflictDetection(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // redundant
        case 'lava_conflict_detection_received':
            ParseEventConflictDetectionReceived(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // provider revealed his vote
        case 'lava_conflict_vote_got_reveal':
            ParseEventConflictVoteGotReveal(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // conflict has transitioned to reveal state
        case 'lava_conflict_vote_reveal_started':
            ParseEventConflictVoteRevealStarted(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // conflict was succesfully resolved
        case 'lava_conflict_detection_vote_resolved':
            ParseEventConflictDetectionVoteResolved(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // conflict was not resolved (did not reach majority)
        // ConflictVoteUnresolvedEventName = "conflict_detection_vote_unresolved"
        case 'lava_conflict_detection_vote_unresolved':
            ParseEventConflictDetectionVoteUnresolved(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
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
            ParseEventDelegateToProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // a successful provider delegation unbond
        case 'lava_unbond_from_provider':
            ParseEventUbondFromProvider(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // // a successful provider redelegation
        case 'lava_redelegate_between_providers':
            ParseEventRedelegateBetweenProviders(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        // // a successful provider delegator reward claim
        // case 'lava_delegator_claim_rewards':
        //     break

        // // spec contributor got new rewards
        // case 'lava_contributor_rewards':
        //     break

        // validator slashed happened, providers slashed accordingly
        case 'lava_validator_slash':
            break

        case 'lava_freeze_from_unbond':
            ParseEventLavaFreezeFromUnbound(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        case 'lava_unstake_from_unbond':
            ParseEventUnstakeFromUnbound(evt, height, txHash, lavaBlock, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
            break

        //
        // Dual stacking
        // https://github.com/lavanet/lava/blob/main/x/projects/types/types.go#L20
        //

        case 'lava_set_subscription_policy_event':
            // TODO - maybe?
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

        default:
            console.log('ProcessOneEvent:: Uknown event', height, evt.type, evt)
            break
    }
}