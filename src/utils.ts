import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';
import retry from 'async-retry';
import util from 'util';
import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import * as lavajs from '@lavanet/lavajs';

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
    const client = await StargateClient.connect(rpc);
    const clientTm = await Tendermint37Client.connect(rpc);
    const chainId = await client.getChainId();
    const height = await client.getHeight();
    const lavajsClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc });
    logger.info(`ConnectToRpc:: chain ${chainId}, current height ${height}`);

    return { client, clientTm, chainId, height, lavajsClient };
}

const postgre_url = process.env['POSTGRESQL_URL']!;

export const GetDb = () => {
    const queryClient = postgres(postgre_url, {
        idle_timeout: 20,
        max_lifetime: 60 * 30,
    });
    const db: PostgresJsDatabase = drizzle(queryClient/*, { logger: true }*/);
    return db
}

export const MigrateDb = async () => {
    logger.info(`MigrateDb:: Starting database migration... ${new Date().toISOString()}`);
    const migrationClient = postgres(postgre_url, { max: 1 });
    logger.info(`MigrateDb:: Migration client created. ${new Date().toISOString()}`);
    await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" });
    logger.info(`MigrateDb:: Database migration completed. ${new Date().toISOString()}`);
}

export async function DoInChunks(sz: number, arr: any, cb: (arr: any) => Promise<any>) {
    while (arr.length != 0) {
        const tmpArr = arr.splice(0, sz)
        await cb(tmpArr)
    }
    return
}