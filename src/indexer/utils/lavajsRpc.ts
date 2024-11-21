// src/utils/rpc.ts

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import * as lavajs from '@lavanet/lavajs';
import { logger } from '@jsinfo/utils/logger';
import { BackoffRetry } from "@jsinfo/utils/retry";
import { GetEnvVar } from '@jsinfo/utils/env';

export interface RpcConnection {
    client: StargateClient;
    clientTm: Tendermint37Client;
    chainId: string;
    height: number;
    lavajsClient: any;
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

        const lavajsClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc });
        logger.info(`ConnectToRpc:: created lavajsClient`);

        return { client, clientTm, chainId, height, lavajsClient };
    } catch (error) {
        logger.error(`ConnectToRpc:: failed to connect to ${rpc}: ${error}`);
        throw error;
    }
}
export class RpcManager {
    private static instance: RpcManager;
    private rpcConnection: RpcConnection | null = null;
    private readonly rpcEndpoint: string;

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
            this.rpcConnection = await ConnectToRpc(this.rpcEndpoint);
        }
        return this.rpcConnection;
    }

    public async queryRpc<T>(
        fn: (client: StargateClient, clientTm: Tendermint37Client, lavajsClient: any) => Promise<T>,
        operationName: string
    ): Promise<T> {
        return await BackoffRetry<T>(
            operationName,
            async () => {
                try {
                    const connection = await this.ensureConnection();
                    return await fn(connection.client, connection.clientTm, connection.lavajsClient);
                } catch (error) {
                    this.rpcConnection = null; // Reset connection on failure
                    throw error;
                }
            }
        );
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
