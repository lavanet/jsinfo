"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stargate_1 = require("@cosmjs/stargate");
const EventRelayPayment_1 = require("./EventRelayPayment");
const EventStakeUpdateProvider_1 = require("./EventStakeUpdateProvider");
const EventStakeNewProvider_1 = require("./EventStakeNewProvider");
const EventProviderUnstakeCommit_1 = require("./EventProviderUnstakeCommit");
const EventFreezeProvider_1 = require("./EventFreezeProvider");
const EventUnfreezeProvider_1 = require("./EventUnfreezeProvider");
const rpc = "https://public-rpc-testnet2.lavanet.xyz/";
const GetEvents = async (height, client) => {
    const lavaBlock = {
        height: height,
        relayPaymentEvts: [],
        stakeNewProviderEvts: [],
        stakeUpdateProviderEvts: [],
        providerUnstakeCommitEvts: [],
        freezeProviderEvts: [],
        unfreezeProviderEvts: [],
    };
    const txs = await client.searchTx('tx.height=' + height);
    txs.forEach((tx) => {
        if (tx.code != 0) {
            return;
        }
        tx.events.forEach((evt) => {
            switch (evt.type) {
                case 'lava_relay_payment':
                    lavaBlock.relayPaymentEvts.push((0, EventRelayPayment_1.ParseEventRelayPayment)(evt));
                    break;
                case 'lava_stake_new_provider':
                    lavaBlock.stakeNewProviderEvts.push((0, EventStakeNewProvider_1.ParseEventStakeNewProvider)(evt));
                    break;
                case 'lava_stake_update_provider':
                    lavaBlock.stakeUpdateProviderEvts.push((0, EventStakeUpdateProvider_1.ParseEventStakeUpdateProvider)(evt));
                    break;
                case 'lava_provider_unstake_commit':
                    lavaBlock.providerUnstakeCommitEvts.push((0, EventProviderUnstakeCommit_1.ParseEventProviderUnstakeCommit)(evt));
                    break;
                case 'lava_freeze_provider':
                    lavaBlock.freezeProviderEvts.push((0, EventFreezeProvider_1.ParseEventFreezeProvider)(evt));
                    break;
                case 'lava_unfreeze_provider':
                    lavaBlock.unfreezeProviderEvts.push((0, EventUnfreezeProvider_1.ParseEventUnfreezeProvider)(evt));
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
                case 'submit_proposal':
                case 'proposal_deposit':
                case 'proposal_vote':
                    break;
                case 'lava_buy_subscription_event':
                case 'lava_add_project_to_subscription_event':
                case 'lava_del_project_to_subscription_event':
                case 'lava_del_key_from_project_event':
                case 'lava_add_key_to_project_event':
                    break;
                case 'lava_conflict_vote_got_commit':
                case 'lava_response_conflict_detection':
                case 'lava_conflict_detection_received':
                    break;
                default:
                    console.log(height, evt.type);
                    break;
            }
        });
    });
    return lavaBlock;
};
const main = async () => {
    const client = await stargate_1.StargateClient.connect(rpc);
    const chainId = await client.getChainId();
    const height = await client.getHeight();
    console.log('chain', chainId, 'current height', height);
    /*const lavaBlock = await GetEvents(344521, client);
    console.log(lavaBlock);*/
    for (let i = 344000; i <= height; i++) {
        if (i % 1000 == 0) {
            console.log(i);
        }
        try {
            await GetEvents(i, client);
        }
        catch {
            console.log('err', i);
        }
    }
};
main();
