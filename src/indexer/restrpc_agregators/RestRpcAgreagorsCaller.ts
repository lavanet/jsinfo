import { ProcessSubscriptionList } from "./SubscriptionList";
import { ProcessProviderMonikerSpecs } from "./ProviderSpecMoniker";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from "../../utils/utils";

// TODO: uncomment chain wallet api to when it is available
// import { RpcEndpointCache } from "../classes/RpcEndpointCache";
// import { ProcessChainWalletApi } from "./ChainWalletApi";
// import { ProcessDualStackingDelegatorRewards } from "./DualStakingDelegatorRewards";

let isRunning = false;

export async function RestRpcAgreagorsCaller(db: PostgresJsDatabase): Promise<void> {
    if (isRunning) {
        logger.info('RestRpcAgreagorsCaller is already running. Exiting this call.');
        return;
    }

    // const providerMetadata = await RpcEndpointCache.GetProviderMetadata();
    // const providerDelegators = await RpcEndpointCache.GetProviderDelegators("lava@1f8kg6htavv67x4e54j6zvlg6pwzcsg52k3wu80");
    // const totalDelegatedAmount = await RpcEndpointCache.GetTotalDelegatedAmount();

    // console.log("providerMetadata", providerMetadata);
    // console.log("providerDelegators", providerDelegators);
    // console.log("totalDelegatedAmount", totalDelegatedAmount);

    isRunning = true;

    logger.info(`ProcessSubscriptionList started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessSubscriptionList(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessSubscriptionList. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessSubscriptionList. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    logger.info(`ProcessProviderMonikerSpecs started at: ${new Date().toISOString()}`);
    try {
        const start = Date.now();
        await ProcessProviderMonikerSpecs(db);
        const executionTime = Date.now() - start;
        logger.info(`Successfully executed ProcessProviderMonikerSpecs. Execution time: ${executionTime} ms`);
    } catch (e) {
        logger.error(`Failed to execute ProcessProviderMonikerSpecs. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
        isRunning = false;
        return;
    }

    // logger.info(`ProcessChainWalletApi started at: ${new Date().toISOString()}`);
    // try {
    //     const start = Date.now();
    //     await ProcessChainWalletApi(db);
    //     const executionTime = Date.now() - start;
    //     logger.info(`Successfully executed ProcessChainWalletApi. Execution time: ${executionTime} ms`);
    // } catch (e) {
    //     logger.error(`Failed to execute ProcessChainWalletApi. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
    //     isRunning = false;
    //     return;
    // }

    // logger.info(`ProcessDualStackingDelegatorRewards started at: ${new Date().toISOString()}`);
    // try {
    //     const start = Date.now();
    //     await ProcessDualStackingDelegatorRewards(db);
    //     const executionTime = Date.now() - start;
    //     logger.info(`Successfully executed ProcessDualStackingDelegatorRewards. Execution time: ${executionTime} ms`);
    // } catch (e) {
    //     logger.error(`Failed to execute ProcessDualStackingDelegatorRewards. Error: ${(e as Error).message}`, { stack: (e as Error).stack });
    //     isRunning = false;
    //     return;
    // }

    isRunning = false;
}

