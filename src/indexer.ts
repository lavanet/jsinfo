// jsinfo/src/indexer.ts

import { logger } from '@jsinfo/utils/logger';
import { IsIndexerProcess } from '@jsinfo/utils/env';

if (!IsIndexerProcess()) {
    console.log('indexer.ts', "not indexer process");
    process.exit();
}

import * as consts from './indexer/indexerConsts';
import { IndexerThreadCallerStart } from './indexer/indexerThreadCaller';

// import { APRMonitor } from './indexer/restrpc_agregators/AprMonitor';
// import { queryRpc } from './indexer/utils/lavajsRpc';
// import { LavaClient } from './indexer/lavaTypes';
// import { SpecAndConsumerService } from './redis/resources/global/SpecAndConsumerResource';
// import { JSONStringify } from './utils/fmt';

const indexer = async (): Promise<void> => {
    logger.info(`Starting indexer, rpc: ${consts.JSINFO_INDEXER_LAVA_RPC}, start height: ${consts.JSINFO_INDEXER_START_BLOCK}`);

    for (const key in consts) {
        if (Object.hasOwnProperty.call(consts, key)) {
            logger.info(`${key}: ${consts[key]}`);
        }
    }

    // const allSpecs = await SpecAndConsumerService.GetAllSpecs();
    // for (const spec of allSpecs) {
    //     const response = await queryRpc(
    //         async (_, __, lavaClient: LavaClient) => lavaClient.lavanet.lava.pairing.providers({ chainID: spec, showFrozen: true }),
    //         'pairing.getProviders'
    //     );

    //     for (const provider of response.stakeEntry) {
    //         const jailEndTime = Number(provider.jailEndTime);
    //         const now = Math.floor(Date.now() / 1000);

    //         const jailEndDate = new Date(jailEndTime * 1000).toISOString();
    //         const isJailed = jailEndTime > now;

    //         if (!isJailed) continue;
    //         console.log({
    //             provider: provider.address,
    //             jail_info: {
    //                 end_timestamp: jailEndTime,
    //                 end_date: jailEndDate,
    //                 is_currently_jailed: isJailed,
    //                 time_remaining: isJailed ?
    //                     `${((jailEndTime - now) / (24 * 60 * 60)).toFixed(2)} days` :
    //                     'Not jailed'
    //             }
    //         });
    //     }
    // }

    // const aprMonitor = APRMonitor;
    // console.log("stating apr monitor")
    // aprMonitor.start();

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
