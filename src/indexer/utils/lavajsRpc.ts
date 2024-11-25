// src/utils/rpc.ts

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import * as lavajs from '@lavanet/lavajs';
import { logger } from '@jsinfo/utils/logger';
import { GetEnvVar } from '@jsinfo/utils/env';
import { LavaClient } from "../lavaTypes";
import { StringifyWithBigInt } from "@jsinfo/utils/bigint";

export interface RpcConnection {
    client: StargateClient;
    clientTm: Tendermint37Client;
    chainId: string;
    height: number;
    lavaClient: LavaClient;
}

export async function ConnectToRpc(rpc: string): Promise<RpcConnection> {
    try {
        // Test HTTP connection first
        logger.info(`ConnectToRpc:: testing HTTP connection to ${rpc}`);
        const healthResponse = await fetch(`${rpc}/health`);

        if (!healthResponse.ok) {
            throw new Error(`HTTP health check failed with status: ${healthResponse.status}`);
        }
        logger.info(`ConnectToRpc:: HTTP health check passed`);

        // Proceed with RPC connection
        logger.info(`ConnectToRpc:: connecting to ${rpc}`);
        const client = await StargateClient.connect(rpc);
        logger.info(`ConnectToRpc:: connected to StargateClient`);

        const clientTm = await Tendermint37Client.connect(rpc);
        logger.info(`ConnectToRpc:: connected to Tendermint37Client`);

        const chainId = await client.getChainId();
        logger.info(`ConnectToRpc:: fetched chainId ${chainId}`);

        const height = await client.getHeight();
        logger.info(`ConnectToRpc:: fetched height ${height}`);

        const lavaClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc })
        // const chains = await lavaClient.lavanet.lava.spec.showAllChains();
        // logger.info(`ConnectToRpc:: fetched chains ${StringifyWithBigInt(chains).substring(0, 1000)}`);

        return { client, clientTm, chainId, height, lavaClient };
    } catch (error) {
        logger.error(`ConnectToRpc:: failed to connect to ${rpc}: ${error}`);
        throw error;
    }
}
export class RpcManager {
    private static instance: RpcManager;
    private rpcConnection: RpcConnection | null = null;
    private readonly rpcEndpoint: string;
    private connectionPromise: Promise<RpcConnection> | null = null; // Track the ongoing connection promise

    private constructor() {
        this.rpcEndpoint = GetEnvVar('JSINFO_INDEXER_LAVA_RPC');
    }

    public static getInstance(): RpcManager {
        if (!RpcManager.instance) {
            RpcManager.instance = new RpcManager();
        }
        return RpcManager.instance;
    }

    private async ensureConnection(): Promise<RpcConnection> {
        if (!this.rpcConnection) {
            if (!this.connectionPromise) {
                this.connectionPromise = ConnectToRpc(this.rpcEndpoint).then(connection => {
                    this.rpcConnection = connection;
                    this.connectionPromise = null; // Reset the promise after successful connection
                    return connection;
                }).catch(error => {
                    this.connectionPromise = null; // Reset on error
                    throw error;
                });
            }
            return this.connectionPromise; // Return the ongoing promise
        }
        return this.rpcConnection; // Return the existing connection
    }

    public async queryRpc<T>(
        fn: (client: StargateClient, clientTm: Tendermint37Client, lavajsClient: LavaClient) => Promise<T>,
        operationName: string,
        maxRetries: number = 3, // Maximum number of retries
        retryDelay: number = 1000 // Delay between retries in milliseconds
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const connection = await this.ensureConnection();
                return await fn(connection.client, connection.clientTm, connection.lavaClient);
            } catch (error) {
                this.rpcConnection = null; // Reset connection on failure
                console.error(`Attempt ${attempt} for operation "${operationName}" failed: ${(error as Error).message}`);

                if (attempt < maxRetries) {
                    console.log(`Retrying in ${retryDelay}ms...`);
                    await this.sleep(retryDelay); // Wait before retrying
                } else {
                    throw new Error(`Operation "${operationName}" failed after ${maxRetries} attempts: ${(error as Error).message}`);
                }
            }
        }
        throw new Error(`Operation "${operationName}" failed without a successful return.`);
    }

    // Helper method to sleep
    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage example:
export const rpcManager = RpcManager.getInstance();
export const queryRpc = async <T>(
    fn: (client: StargateClient, clientTm: Tendermint37Client, lavajsClient: any) => Promise<T>,
    operationName: string
): Promise<T> => {
    return await rpcManager.queryRpc(fn, operationName);
}
