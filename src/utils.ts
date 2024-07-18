
import retry from 'async-retry';
import util from 'util';
import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import * as lavajs from '@lavanet/lavajs';
import axios from 'axios';


export function GetEnvVar(key: string, alt?: string): string {
    const value = process.env[key];
    if (!value) {
        if (alt !== undefined) {
            return alt;
        }
        throw new Error(`${key} environment variable is not set or is an empty string`);
    }
    return value;
}

const winston = require('winston');

export const logger = winston.createLogger({
    level: 'silly',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                winston.format.printf(({ level, message, label, timestamp }) => {
                    return `${timestamp} ${level}: ${message}`;
                })
            )
        })
    ]
});

// Define the BackoffRetry function
export const BackoffRetry = async <T>(title: string, fn: () => Promise<T>): Promise<T> => {
    return await retry(fn,
        {
            retries: 8, // The maximum amount of times to retry the operation
            factor: 2,  // The exponential factor to use
            minTimeout: 1000, // The number of milliseconds before starting the first retry
            maxTimeout: 5000, // The maximum number of milliseconds between two retries
            randomize: true, // Randomizes the timeouts by multiplying with a factor between 1 to 2
            onRetry: (error: any, attempt: any) => {
                let errorMessage = `[Backoff Retry] Function: ${title}\n`;
                try {
                    errorMessage += `Attempt number: ${attempt} has failed.\n`;
                    if (error instanceof Error) {
                        errorMessage += `An error occurred during the execution of ${title}: ${error.message}\n`;
                        errorMessage += `Stack trace for the error in ${title}: ${error.stack}\n`;
                        errorMessage += `Full error object: ${util.inspect(error, { showHidden: true, depth: null })}\n`;
                    } else {
                        errorMessage += `An unknown error occurred during the execution of ${title}: ${error}\n`;
                    }
                } catch (e) { }
                logger.error(errorMessage);
            }
        }
    );
};

export interface RpcConnection {
    client: StargateClient;
    clientTm: Tendermint37Client;
    chainId: string;
    height: number;
    lavajsClient: any;
}

export async function ConnectToRpc(rpc: string): Promise<RpcConnection> {
    try {
        await axios.get(rpc);
        logger.info(`ConnectToRpc:: http tested successfully connected to ${rpc}`);
    } catch (error) {
        logger.error(`ConnectToRpc:: error connecting to ${rpc}: ${error}`);
        throw error;
    }

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

export function Sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let cachedPostgresUrl: string | null = null;

export async function GetPostgresUrl(): Promise<string> {
    if (cachedPostgresUrl !== null) {
        return cachedPostgresUrl;
    }
    try {
        cachedPostgresUrl = GetEnvVar("JSINFO_POSTGRESQL_URL");
    } catch (error) {
        try {
            cachedPostgresUrl = GetEnvVar("POSTGRESQL_URL");
        } catch (error) {
            console.error("Missing env var for POSTGRESQL_URL or JSINFO_POSTGRESQL_URL");
            await Sleep(60000); // Sleep for one minute
            process.exit(1);
        }
    }
    return cachedPostgresUrl!;
}

export async function DoInChunks(sz: number, arr: any[], cb: (arr: any[]) => Promise<any>) {
    while (arr.length != 0) {
        const tmpArr = arr.splice(0, sz);
        try {
            await cb(tmpArr);
        } catch (error) {
            console.error(`Error processing chunk: ${JSON.stringify(tmpArr)}`);
            console.error(`Callback function: ${cb.toString()}`);
            if (error instanceof Error) {
                console.error(`Error message: ${error.message}`);
                console.error(`Stack Trace: ${error.stack}`);
            }
            throw error;
        }
    }
    return;
}


export const establishRpcConnection = async (rpc: string): Promise<RpcConnection> => {
    logger.info('Establishing RPC connection...');
    const rpcConnection: RpcConnection = await BackoffRetry<RpcConnection>("ConnectToRpc", () => ConnectToRpc(rpc));
    logger.info('RPC connection established.', rpcConnection);
    return rpcConnection;
};