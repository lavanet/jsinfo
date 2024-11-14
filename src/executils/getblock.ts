// src/executils/getblock.ts

import { GetRpcBlock, GetRpcTxs } from "../indexer/lavaBlock";
import { logger } from "../utils/utils";
import { ConnectToRpc, RpcConnection } from "../indexer/utils/lavajsRpc";
import * as indexerconsts from '../indexer/indexerConsts';

const printBlockAndTxs = async (height: number, rpcConnection: RpcConnection): Promise<void> => {
    try {
        const block = await GetRpcBlock(height, rpcConnection.client);
        console.log(`Block at height ${height}:`, block);

        const txs = await GetRpcTxs(height, rpcConnection.client, block);
        console.log(`Transactions at height ${height}:`, txs);
    } catch (error) {
        console.error(`Error at height ${height}:`, error);
    }
};

const main = async (): Promise<void> => {
    // Check if a block number argument is provided
    if (process.argv.length < 3) {
        console.log('Usage: node getBlock.ts <blocknum>');
        process.exit(1);
    }

    // Parse the block number from the command line arguments
    const blockNum = parseInt(process.argv[2], 10);
    if (isNaN(blockNum)) {
        console.error('Error: <blocknum> must be a valid number.');
        process.exit(1);
    }

    logger.info(`Starting indexer, rpc: ${indexerconsts.JSINFO_INDEXER_LAVA_RPC}, block number: ${blockNum}`);

    for (const key in indexerconsts) {
        if (Object.hasOwnProperty.call(indexerconsts, key)) {
            logger.info(`${key}: ${indexerconsts[key]}`);
        }
    }

    const rpcConnection = await ConnectToRpc(indexerconsts.JSINFO_INDEXER_LAVA_RPC);

    // Use the provided block number instead of starting from a predefined start height
    await printBlockAndTxs(blockNum, rpcConnection);
};

main().catch(error => {
    console.error('Error in main function:', error);
    process.exit(1);
});

