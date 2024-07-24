// src/indexer/eventDebug.ts

import { GetRpcBlock, GetRpcTxs, GetRpcBlockResultEvents } from "./lavaBlock";
import { logger, RpcConnection } from "../utils";
import { ProcessOneEvent } from "./eventProcessor";
import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import { LavaBlock } from "./types";

const EVENT_DEBUG_EXECUTE_PROCESS_ONE_EVENT = true;
const EVENT_DEBUG_SHOULD_PRINT_EVENT = (eventType: string) => {
    return false;
    return eventType.includes("latest_block_report");
};

export const processEvent = (evt: any, height: number, lavaBlock: LavaBlock, source: string,
    blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>, blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
    blockchainEntitiesStakes: Map<string, JsinfoSchema.ProviderStake[]>) => {
    if (EVENT_DEBUG_SHOULD_PRINT_EVENT(evt.type)) {
        logger.info('EventDebug event', height, 'Source:', source, "type:", evt.type, "\n", evt);
    }

    if (EVENT_DEBUG_EXECUTE_PROCESS_ONE_EVENT) {
        ProcessOneEvent(evt, lavaBlock, height, "0xEventDebugHash", blockchainEntitiesProviders, blockchainEntitiesSpecs, blockchainEntitiesStakes);
    }
}

export const EventDebugProcessBlock = async (startHeight: number, rpcConnection: RpcConnection, numInstances: number): Promise<void> => {

    for (let height = startHeight; height >= 0; height -= numInstances) {
        const block = await GetRpcBlock(height, rpcConnection.client);
        const txs = await GetRpcTxs(height, rpcConnection.client, block);

        let blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider> = new Map();
        let blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec> = new Map();
        let blockchainEntitiesStakes: Map<string, JsinfoSchema.ProviderStake[]> = new Map();

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
                //     logger.info('EventDebug txs event', height, evt.type, "\ntx:", tx);
                // }
                processEvent(evt, height, lavaBlock, 'Tx events', blockchainEntitiesProviders, blockchainEntitiesSpecs, blockchainEntitiesStakes);
            });
        });

        const evts = await GetRpcBlockResultEvents(height, rpcConnection.clientTm);
        evts.forEach((evt) => {
            processEvent(evt, height, lavaBlock, 'Block events', blockchainEntitiesProviders, blockchainEntitiesSpecs, blockchainEntitiesStakes);
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