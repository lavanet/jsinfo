// jsinfo/src/indexer.ts

import { logger } from '@jsinfo/utils/logger';
import { IsIndexerProcess } from '@jsinfo/utils/env';

if (!IsIndexerProcess()) {
    console.log('indexer.ts', "not indexer process");
    process.exit();
}

import * as consts from './indexer/indexerConsts';
import { IndexerThreadCallerStart } from './indexer/indexerThreadCaller';
import { APRMonitor } from './indexer/restrpc_agregators/AprMonitor';

const indexer = async (): Promise<void> => {
    logger.info(`Starting indexer, rpc: ${consts.JSINFO_INDEXER_LAVA_RPC}, start height: ${consts.JSINFO_INDEXER_START_BLOCK}`);

    for (const key in consts) {
        if (Object.hasOwnProperty.call(consts, key)) {
            logger.info(`${key}: ${consts[key]}`);
        }
    }

    // const aprMonitor = APRMonitor;
    // console.log("stating apr monitor")
    // aprMonitor.start();


    // await ProcessChainWalletApi();
    // process.exit(0);

    await IndexerThreadCallerStart();
}

try {
    indexer()
} catch (error) {
    if (error instanceof Error) {
        console.log('An error occurred while running the indexer:', error.message);
        console.log('Stack trace:', error.stack);
    } else {
        console.log('An unknown error occurred while running the indexer:', error);
    }
}
