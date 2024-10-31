// src/utils/rpc.ts

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import * as lavajs from '@lavanet/lavajs';
import { logger } from "../../utils/utils";

export interface RpcConnection {
    client: StargateClient;
    clientTm: Tendermint37Client;
    chainId: string;
    height: number;
    lavajsClient: any;
}

export async function ConnectToRpc(rpc: string): Promise<RpcConnection> {

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
}