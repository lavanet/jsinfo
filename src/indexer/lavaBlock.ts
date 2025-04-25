// src/indexer/lavaBlock.ts

import { IndexedTx, Block, Event } from "@cosmjs/stargate"
import { ProcessOneEvent } from './eventProcessor';
import { LavaBlock } from './lavaTypes';
import LavaBlockCache from './lavaBlockCache';
import { logger } from '@jsinfo/utils/logger';
import { queryRpc } from './utils/lavajsRpc';

const cache = new LavaBlockCache();

export const GetRpcBlock = async (
    height: number,
): Promise<Block> => {
    return queryRpc(
        async (client, clientTm) => {
            return cache.getOrGenerate<Block>(height, "block", async () => {
                const block = await client.getBlock(height);
                if (block.header === undefined) {
                    throw new Error('block.header is undefined');
                }
                return block;
            });
        },
        "GetRpcBlock"
    );
}

export const GetRpcTxs = async (
    height: number,
    block: Block,
): Promise<IndexedTx[]> => {
    return queryRpc(
        async (client, clientTm) => {
            return cache.getOrGenerate<IndexedTx[]>(height, "txs", async () => {
                const txs = await client.searchTx(`tx.height=${height}`);
                if (txs.length === 0 && block.txs.length !== 0) {
                    console.warn('txs.length == 0 && block.txs.length != 0');
                }
                return txs;
            });
        },
        "GetRpcTxs"
    );
}

export const GetRpcBlockResultEvents = async (
    height: number,
): Promise<Event[]> => {
    return queryRpc(
        async (client, clientTm) => {
            return cache.getOrGenerate<Event[]>(height, "events", async () => {
                const res = await clientTm.blockResults(height);
                const evts = [...res.beginBlockEvents, ...res.endBlockEvents];
                if (res.height != height) {
                    throw new Error('res.height != height');
                }
                return evts;
            });
        },
        "GetRpcBlockResultEvents"
    );
}

export const GetOneLavaBlock = async (
    height: number
): Promise<LavaBlock> => {

    const startTimeBlock = Date.now();
    const block = await GetRpcBlock(height);
    const endTimeBlock = Date.now();
    if (endTimeBlock - startTimeBlock > 30000) {
        logger.info('GetRpcBlock took', {
            duration: endTimeBlock - startTimeBlock,
            unit: 'milliseconds',
            blockHeight: height
        });
    }

    const startTimeTxs = Date.now();
    const txs = await GetRpcTxs(height, block);
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
    const evts = await GetRpcBlockResultEvents(height);
    const endTimeEvts = Date.now();
    if (endTimeEvts - startTimeEvts > 30000) {
        logger.info('GetRpcBlockResultEvents took', {
            duration: endTimeEvts - startTimeEvts,
            unit: 'milliseconds',
            returnedItems: evts.length,
            blockHeight: height
        });
    }

    const blockTime = new Date(block!.header.time);

    const lavaBlock: LavaBlock = {
        height: height,
        datetime: blockTime.getTime(),
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
        ))
    });

    evts.forEach((evt) => ProcessOneEvent(
        evt,
        lavaBlock,
        height,
        null,
    ))

    return lavaBlock;
}