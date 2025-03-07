import { logger } from '../utils/logger';
import { ConnectToRpc, RpcConnection } from '../indexer/utils/lavajsRpc';
import { GetRpcBlock, GetRpcTxs, GetRpcBlockResultEvents } from "../indexer/lavaBlock";
// import { ProcessOneEvent } from "../indexer/eventProcessor";
import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import { LavaBlock } from "../indexer/lavaTypes";
import * as consts from '../indexer/indexerConsts';

export const processEvent = (evt: any, height: number, lavaBlock: LavaBlock, source: string) => {

    if (evt.type.toLowerCase().includes('reported')) {
        logger.debug('Provider Report Event', {
            type: evt.type,
            content: evt,
            timestamp: new Date().toISOString(),
            height: height,
            source: source,
        });
    }

    // if (EVENT_DEBUG_SHOULD_PRINT_EVENT(evt.type)) {
    //     logger.info('EventDebug event', height, 'Source:', source, "type:", evt.type, "\n", evt);
    // }

    // if (EVENT_DEBUG_EXECUTE_PROCESS_ONE_EVENT) {
    //     ProcessOneEvent(evt, lavaBlock, height, "0xEventDebugHash");
    // }
}

export const EventDebugProcessBlock = async (startHeight: number, rpcConnection: RpcConnection, numInstances: number): Promise<void> => {

    for (let height = startHeight; height >= 0; height -= numInstances) {
        const block = await GetRpcBlock(height);
        const txs = await GetRpcTxs(height, block);

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

        txs.forEach((tx) => {
            if (tx.code != 0) {
                return;
            }

            tx.events.forEach((evt) => {
                processEvent(evt, height, lavaBlock, 'Tx events');
            });
        });

        const evts = await GetRpcBlockResultEvents(height);
        evts.forEach((evt) => {
            processEvent(evt, height, lavaBlock, 'Block events');
        });
    }
}

export const EventDebug = async (rpcConnection: RpcConnection): Promise<void> => {
    let currentHeight = await rpcConnection.client.getHeight() - 10000;
    const numInstances = 10;

    const instances: Promise<void>[] = [];

    for (let i = 0; i < numInstances; i++) {
        instances.push(EventDebugProcessBlock(currentHeight - i, rpcConnection, numInstances));
    }

    await Promise.all(instances);
}

const main = async (): Promise<void> => {
    logger.info(`Starting indexer, rpc: ${consts.JSINFO_INDEXER_LAVA_RPC}`);

    const rpcConnection = await establishRpcConnection();

    await EventDebug(rpcConnection);
}

const establishRpcConnection = async (): Promise<RpcConnection> => {
    logger.info('Establishing RPC connection...');
    const rpcConnection: RpcConnection = await ConnectToRpc(consts.JSINFO_INDEXER_LAVA_RPC);
    logger.info('RPC connection established.');
    return rpcConnection;
}

try {
    main()
} catch (error) {
    if (error instanceof Error) {
        console.log('An error occurred while running the indexer:', error.message);
        console.log('Stack trace:', error.stack);
    } else {
        console.log('An unknown error occurred while running the indexer:', error);
    }
}