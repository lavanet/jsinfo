// src/indexer/eventDebug.ts

import { GetRpcBlock, GetRpcTxs, GetRpcBlockResultEvents } from "./lavaBlock";
import { RpcConnection } from "../utils";
import { ProcessOneEvent } from "./eventProcessor";
import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import { LavaBlock } from "./types";

const EVENT_DEBUG_EXECUTE_PROCESS_ONE_EVENT = true;
const EVENT_DEBUG_SHOULD_PRINT_EVENT = (eventType: string) => {
    return false;
    return eventType.includes("latest_block_report");
};

export const processEvent = (evt: any, height: number, lavaBlock: LavaBlock, source: string,
    static_dbProviders: Map<string, JsinfoSchema.Provider>, static_dbSpecs: Map<string, JsinfoSchema.Spec>,
    static_dbPlans: Map<string, JsinfoSchema.Plan>, static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>) => {
    if (EVENT_DEBUG_SHOULD_PRINT_EVENT(evt.type)) {
        console.log('EventDebug event', height, 'Source:', source, "type:", evt.type, "\n", evt);
    }

    if (EVENT_DEBUG_EXECUTE_PROCESS_ONE_EVENT) {
        ProcessOneEvent(evt, lavaBlock, height, "0xEventDebugHash", static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes);
    }
}

export const EventDebugProcessBlock = async (startHeight: number, rpcConnection: RpcConnection, numInstances: number): Promise<void> => {

    for (let height = startHeight; height >= 0; height -= numInstances) {
        const block = await GetRpcBlock(height, rpcConnection.client);
        const txs = await GetRpcTxs(height, rpcConnection.client, block);

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
            dbProviderLatestBlockReports: [],
        }

        txs.forEach((tx) => {
            if (tx.code != 0) {
                return;
            }

            tx.events.forEach((evt) => {
                // if (EVENT_DEBUG_SHOULD_PRINT_EVENT(evt.type)) {
                //     console.log('EventDebug txs event', height, evt.type, "\ntx:", tx);
                // }
                processEvent(evt, height, lavaBlock, 'Tx events', static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes);
            });
        });

        const evts = await GetRpcBlockResultEvents(height, rpcConnection.clientTm);
        evts.forEach((evt) => {
            processEvent(evt, height, lavaBlock, 'Block events', static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes);
        });
    }
}

export const EventDebug = async (rpcConnection: RpcConnection): Promise<void> => {
    let currentHeight = await rpcConnection.client.getHeight();
    const numInstances = 10;

    const instances: Promise<void>[] = [];

    for (let i = 0; i < numInstances; i++) {
        instances.push(EventDebugProcessBlock(currentHeight - i, rpcConnection, numInstances));
    }

    await Promise.all(instances);
}