
import { GetRpcBlock, GetRpcTxs, GetRpcBlockResultEvents } from "./lavablock";
import { RpcConnection } from "../utils";
import { ProcessOneEvent } from "./eventProcessor";
import * as JsinfoSchema from '../schemas/jsinfo_schema';
import { LavaBlock } from "./types";

export const LavaBlockDebugDumpEventsProcessBlock = async (instanceIdx: number, startHeight: number, rpcConnection: RpcConnection,
    eventNames: string[], printAllEvents: boolean, numInstances: number): Promise<void> => {

    for (let height = startHeight; height >= 0; height -= numInstances) {
        // console.log('Processing block number:', height); // Print the current block number

        const block = await GetRpcBlock(height, rpcConnection.client);
        const txs = await GetRpcTxs(height, rpcConnection.client, block);



        // // searching for event names
        // txs.forEach((tx) => {
        //     if (tx.code != 0) {
        //         return;
        //     }

        //     tx.events.forEach((evt) => {
        //         // use this to find events that are not known
        //         // if (!LavaBlockDebugDumpEventsProcessBlockAllEvents.filter(event => !eventNames.includes(event))) {
        //         if (printAllEvents || eventNames.some(name => evt.type.includes(name))) {
        //             console.log('LavaBlockDebugDumpEvents txs event', height, evt.type, evt);
        //         }
        //     });
        // });

        // const evts = await GetRpcBlockResultEvents(height, rpcConnection.clientTm);
        // evts.forEach((evt) => {
        //     // if (!LavaBlockDebugDumpEventsProcessBlockAllEvents.filter(event => !eventNames.includes(event))) {
        //     if (printAllEvents || eventNames.some(name => evt.type.includes(name))) {
        //         console.log('LavaBlockDebugDumpEvents event', height, evt.type, evt);
        //     }
        // });




        // searching for events that have 'ulava' in them
        // txs.forEach((tx) => {
        //     if (tx.code != 0) {
        //         return;
        //     }

        //     tx.events.forEach((evt) => {
        //         if (evt.type === 'lava_relay_payment') {
        //             return;
        //         }

        //         if (evt.type.includes('lava_') && evt.attributes.some(attr => attr.value.includes('ulava'))) {
        //             console.log('LavaBlockDebugDumpEvents txs event', height, evt.type, evt);
        //         }
        //     });
        // });

        // const evts = await GetRpcBlockResultEvents(height, rpcConnection.clientTm);
        // evts.forEach((evt) => {
        //     if (evt.type === 'lava_relay_payment') {
        //         return;
        //     }

        //     if (evt.type.includes('lava_') && evt.attributes.some(attr => attr.value.includes('ulava'))) {
        //         console.log('LavaBlockDebugDumpEvents event', height, evt.type, evt);
        //     }
        // });




        let static_dbProviders: Map<string, JsinfoSchema.Provider> = new Map();
        let static_dbSpecs: Map<string, JsinfoSchema.Spec> = new Map();
        let static_dbPlans: Map<string, JsinfoSchema.Plan> = new Map();
        let static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]> = new Map();

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

        /*
        export const ProcessOneEvent = (
            evt: Event,
            lavaBlock: LavaBlock,
            height: number,
            txHash: string | null,
            static_dbProviders: Map<string,JsinfoSchema.Provider>,
            static_dbSpecs: Map<string,JsinfoSchema.Spec>,
            static_dbPlans: Map<string,JsinfoSchema.Plan>,
            static_dbStakes: Map<string,JsinfoSchema.ProviderStake[]>,
        ) => {
        */

        // test parsing for events
        txs.forEach((tx) => {
            if (tx.code != 0) {
                return;
            }

            tx.events.forEach((evt) => {
                ProcessOneEvent(evt, lavaBlock, height, "777", static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes);
            });
        });

        const evts = await GetRpcBlockResultEvents(height, rpcConnection.clientTm);
        evts.forEach((evt) => {
            ProcessOneEvent(evt, lavaBlock, height, "777", static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes);
        });
    }
}

export const LavaBlockDebugDumpEvents = async (rpcConnection: RpcConnection, printAllEvents = false): Promise<void> => {
    // conflict events
    // const eventNames = [
    //     "delegate_to_provider",
    //     "unbond_from_provider",
    //     "redelegate_between_providers",
    //     "delegator_claim_rewards",
    //     "contributor_rewards",
    //     "validator_slash",
    //     "freeze_from_unbond",
    //     "unstake_from_unbond",
    // ];

    const eventNames = [
        // 'advanced_buy_subscription_event',
        // 'advanced_buy_upgrade_subscription_event',
        // 'subscription_auto_renew_change_event',
        // 'upgrade_subscription_event',
        // 'expire_subscription_event',
        // 'add_tracked_cu_event',
        // 'monthly_cu_tracker_provider_reward',
        // 'subscription_remaining_credit',
        // 'lava_fixated_params_change',
        // 'lava_fixated_params_clean',
        // 'unstake_commit', - no good example
        'add_key_to_project_event',
        'lava_del_project_to_subscription_event'
    ];

    let currentHeight = await rpcConnection.client.getHeight();
    const numInstances = 10;

    const instances: Promise<void>[] = [];

    for (let i = 0; i < numInstances; i++) {
        instances.push(LavaBlockDebugDumpEventsProcessBlock(i, currentHeight - i, rpcConnection, eventNames, printAllEvents, numInstances));
    }

    // Wait for all instances to finish
    await Promise.all(instances);
}