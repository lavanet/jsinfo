// src/indexer/lavaBlock.ts

import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import { StargateClient, IndexedTx, Block, Event } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { ProcessOneEvent } from './eventProcessor';
import { LavaBlock } from './types';
import LavaBlockCache from './lavaBlockCache';
import { logger } from '../utils/utils';

const cache = new LavaBlockCache();

export const GetRpcBlock = async (
    height: number,
    client: StargateClient,
): Promise<Block> => {
    return cache.getOrGenerate<Block>(height, "block", async () => {
        const block = await client.getBlock(height);
        if (block.header === undefined) {
            throw new Error('block.header is undefined');
        }
        return block;
    });
}

export const GetRpcTxs = async (
    height: number,
    client: StargateClient,
    block: Block,
): Promise<IndexedTx[]> => {
    return cache.getOrGenerate<IndexedTx[]>(height, "txs", async () => {
        const txs = await client.searchTx(`tx.height=${height}`);
        if (txs.length === 0 && block.txs.length !== 0) {
            throw new Error('txs.length == 0 && block.txs.length != 0');
        }
        return txs;
    });
}

export const GetRpcBlockResultEvents = async (
    height: number,
    client: Tendermint37Client
): Promise<Event[]> => {
    return cache.getOrGenerate<Event[]>(height, "events", async () => {
        const res = await client.blockResults(height);
        const evts = [...res.beginBlockEvents, ...res.endBlockEvents];
        if (res.height != height) {
            throw new Error('res.height != height');
        }
        return evts;
    });
}

export const GetOneLavaBlock = async (
    height: number,
    client: StargateClient,
    clientTm: Tendermint37Client,


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
): Promise<LavaBlock> => {

    const startTimeBlock = Date.now();
    const block = await GetRpcBlock(height, client);
    const endTimeBlock = Date.now();
    if (endTimeBlock - startTimeBlock > 30000) {
        logger.info('GetRpcBlock took', {
            duration: endTimeBlock - startTimeBlock,
            unit: 'milliseconds',
            returnedItems: block,
            blockHeight: height
        });
    }

    const startTimeTxs = Date.now();
    const txs = await GetRpcTxs(height, client, block);
    const endTimeTxs = Date.now();
    if (endTimeTxs - startTimeTxs > 30000) {
        logger.info('GetRpcTxs took', {
            duration: endTimeTxs - startTimeTxs,
            unit: 'milliseconds',
            returnedItems: txs.length,
            blockHeight: height
        });
    }

    const startTimeEvts = Date.now();
    const evts = await GetRpcBlockResultEvents(height, clientTm);
    const endTimeEvts = Date.now();
    if (endTimeEvts - startTimeEvts > 30000) {
        logger.info('GetRpcBlockResultEvents took', {
            duration: endTimeEvts - startTimeEvts,
            unit: 'milliseconds',
            returnedItems: evts.length,
            blockHeight: height
        });
    }

    // Block object to return
    const lavaBlock: LavaBlock = {
        height: height,
        datetime: Date.parse(block!.header.time),
        dbEvents: [],
        dbPayments: [],
        dbConflictResponses: [],
        dbSubscriptionBuys: [],
        dbConflictVote: [],
        dbProviderReports: [],
        dbProviderLatestBlockReports: [],
    }

    // Loop over txs in block
    txs.forEach((tx) => {

        // Pass on failed txs
        if (tx.code != 0) {
            return;
        }

        tx.events.forEach((evt) => ProcessOneEvent(
            evt,
            lavaBlock,
            height,
            tx.hash,
            blockchainEntitiesStakes
        ))
    });

    evts.forEach((evt) => ProcessOneEvent(
        evt,
        lavaBlock,
        height,
        null,
        blockchainEntitiesStakes
    ))

    return lavaBlock;
}
