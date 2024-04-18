
import * as schema from '../schema';

import { StargateClient, IndexedTx, Block, Event } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { writeFileSync, readFileSync } from 'fs';

import { JSINFO_INDEXER_CACHE_PATH, JSINFO_INDEXER_IS_READ_CACHE, JSINFO_INDEXER_IS_SAVE_CACHE } from './indexerConsts';
import { ProcessOneEvent } from './eventProcessor';
import { LavaBlock } from './types';

//
// Get block (mostly for date)
export const GetRpcBlock = async (
    height: number,
    client: StargateClient,
): Promise<Block> => {
    const pathBlocks = `${JSINFO_INDEXER_CACHE_PATH}${height.toString()}.json`
    let block: Block;
    let excp = true

    if (JSINFO_INDEXER_IS_READ_CACHE) {
        try {
            excp = false
            block = JSON.parse(readFileSync(pathBlocks, 'utf-8')) as Block
        }
        catch {
            excp = true
        }
    }
    if (excp || block!.header == undefined) {
        block = await client.getBlock(height)
        if (block!.header == undefined) {
            throw ('block!.header == undefined')
        }
        if (JSINFO_INDEXER_IS_SAVE_CACHE) {
            writeFileSync(pathBlocks, JSON.stringify(block, null, 0), 'utf-8')
        }
    }

    return block!
}

export const GetRpcTxs = async (
    height: number,
    client: StargateClient,
    block: Block,
): Promise<IndexedTx[]> => {
    //
    // Get Txs for block
    const pathTxs = `${JSINFO_INDEXER_CACHE_PATH}${height.toString()}_txs.json`
    let txs: IndexedTx[] = []
    let excp = true

    if (JSINFO_INDEXER_IS_READ_CACHE) {
        try {
            excp = false
            txs = JSON.parse(readFileSync(pathTxs, 'utf-8')) as IndexedTx[]
        }
        catch {
            excp = true
        }
    }
    if (excp) {
        txs = await client.searchTx('tx.height=' + height)
        if (txs.length == 0 && block!.txs.length != 0) {
            throw ('txs.length == 0 && block!.txs.length != 0')
        }
        if (JSINFO_INDEXER_IS_SAVE_CACHE) {
            writeFileSync(pathTxs, JSON.stringify(txs, null, 0), 'utf-8')
        }
    }

    return txs
}

export const GetRpcBlockResultEvents = async (
    height: number,
    client: Tendermint37Client
): Promise<Event[]> => {
    //
    // Get Begin/End block events
    const pathTxs = `${JSINFO_INDEXER_CACHE_PATH}${height.toString()}_block_evts.json`
    let evts: Event[] = []
    let excp = true

    if (JSINFO_INDEXER_IS_READ_CACHE) {
        try {
            excp = false
            evts = JSON.parse(readFileSync(pathTxs, 'utf-8')) as Event[]
        }
        catch {
            excp = true
        }
    }
    if (excp) {
        const res = await client.blockResults(height)
        evts.push(...res.beginBlockEvents)
        evts.push(...res.endBlockEvents)
        if (res.height != height) {
            throw ('res.height != height')
        }
        if (JSINFO_INDEXER_IS_SAVE_CACHE) {
            writeFileSync(pathTxs, JSON.stringify(evts, null, 0), 'utf-8')
        }
    }

    return evts
}

export const GetOneLavaBlock = async (
    height: number,
    client: StargateClient,
    clientTm: Tendermint37Client,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
): Promise<LavaBlock> => {

    const startTimeBlock = Date.now();
    const block = await GetRpcBlock(height, client);
    const endTimeBlock = Date.now();
    if (endTimeBlock - startTimeBlock > 30000) {
        console.log('GetRpcBlock took', endTimeBlock - startTimeBlock, 'milliseconds. It returned', block, 'items at block height', height);
    }

    const startTimeTxs = Date.now();
    const txs = await GetRpcTxs(height, client, block);
    const endTimeTxs = Date.now();
    if (endTimeTxs - startTimeTxs > 30000) {
        console.log('GetRpcTxs took', endTimeTxs - startTimeTxs, 'milliseconds. It returned', txs.length, 'items at block height', height);
    }

    const startTimeEvts = Date.now();
    const evts = await GetRpcBlockResultEvents(height, clientTm);
    const endTimeEvts = Date.now();
    if (endTimeEvts - startTimeEvts > 30000) {
        console.log('GetRpcBlockResultEvents took', endTimeEvts - startTimeEvts, 'milliseconds. It returned', evts.length, 'items at block height', height);
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

        tx.events.forEach((evt) => ProcessOneEvent(
            evt,
            lavaBlock,
            height,
            tx.hash,
            static_dbProviders,
            static_dbSpecs,
            static_dbPlans,
            static_dbStakes
        ))
    });
    evts.forEach((evt) => ProcessOneEvent(
        evt,
        lavaBlock,
        height,
        null,
        static_dbProviders,
        static_dbSpecs,
        static_dbPlans,
        static_dbStakes
    ))

    return lavaBlock;
}
