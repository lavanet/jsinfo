// jsinfo/src/indexer.ts

import { StargateClient } from "@cosmjs/stargate"
import { Tendermint37Client } from "@cosmjs/tendermint-rpc";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq, desc, and } from "drizzle-orm";
import * as lavajs from '@lavanet/lavajs';
import { PromisePool } from '@supercharge/promise-pool'
import retry from 'async-retry';
import util from 'util';
import * as schema from "./schema";
import { LavaBlock, GetOneLavaBlock } from './lavablock'
import { UpdateLatestBlockMeta } from './setlatest'
import { MigrateDb, GetDb, DoInChunks } from "./utils";
import { log } from "console";

const rpc = process.env['LAVA_RPC'] as string
const n_workers = parseInt(process.env['N_WORKERS']!)
const batch_size = parseInt(process.env['BATCH_SIZE']!)
const poll_ms = parseInt(process.env['POLL_MS']!)
const lava_testnet2_start_height = parseInt(process.env['START_BLOCK']!) // 340778 has a weird date (9 months ago)
let static_dbProviders: Map<string, schema.Provider> = new Map()
let static_dbSpecs: Map<string, schema.Spec> = new Map()
let static_dbPlans: Map<string, schema.Plan> = new Map()
let static_dbStakes: Map<string, schema.ProviderStake[]> = new Map()
const globakWorkList: number[] = []

async function isBlockInDb(
    db: PostgresJsDatabase,
    height: number,
): Promise<boolean> {
    //
    // Is in DB already?
    const dbBlock = await db.select().from(schema.blocks).where(eq(schema.blocks.height, height));
    if (dbBlock.length != 0) {
        return true
    }
    return false
}

async function InsertBlock(
    block: LavaBlock,
    db: PostgresJsDatabase,
) {
    //
    // We use a transaction to revert insert on any errors
    await db.transaction(async (tx) => {
        // insert block
        await tx.insert(schema.blocks).values({ height: block.height, datetime: new Date(block.datetime) })

        // Insert all specs
        const arrSpecs = Array.from(block.dbSpecs.values())
        await DoInChunks(100, arrSpecs, async (arr: any) => {
            await tx.insert(schema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Insert all Txs
        const arrTxs = Array.from(block.dbTxs.values())
        await DoInChunks(100, arrTxs, async (arr: any) => {
            await tx.insert(schema.txs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all providers
        const arrProviders = Array.from(block.dbProviders.values())
        await DoInChunks(100, arrProviders, async (arr: any) => {
            await tx.insert(schema.providers)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all plans
        const arrPlans = Array.from(block.dbPlans.values())
        await DoInChunks(100, arrPlans, async (arr: any) => {
            await tx.insert(schema.plans)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all consumers
        const arrConsumers = Array.from(block.dbConsumers.values())
        await DoInChunks(100, arrConsumers, async (arr: any) => {
            await tx.insert(schema.consumers)
                .values(arr)
                .onConflictDoNothing();
        })

        // Create
        await DoInChunks(100, block.dbEvents, async (arr: any) => {
            await tx.insert(schema.events).values(arr)
        })

        await DoInChunks(100, block.dbPayments, async (arr: any) => {
            await tx.insert(schema.relayPayments).values(arr)
        })

        await DoInChunks(100, block.dbConflictResponses, async (arr: any) => {
            await tx.insert(schema.conflictResponses).values(arr)
        })

        await DoInChunks(100, block.dbSubscriptionBuys, async (arr: any) => {
            await tx.insert(schema.subscriptionBuys).values(arr)
        })

        await DoInChunks(100, block.dbConflictVote, async (arr: any) => {
            await tx.insert(schema.conflictVotes).values(arr)
        })

        await DoInChunks(100, block.dbProviderReports, async (arr: any) => {
            await tx.insert(schema.providerReported).values(arr)
        })
    })
}

const doBatch = async (
    db: PostgresJsDatabase,
    client: StargateClient,
    clientTm: Tendermint37Client,
    dbHeight: number,
    latestHeight: number,
) => {
    //
    // Start filling up
    console.log('globakWorkList', globakWorkList.length, globakWorkList)
    const blockList = [...globakWorkList]
    globakWorkList.length = 0
    for (let i = dbHeight + 1; i <= latestHeight; i++) {
        blockList.push(i)
    }
    const org_len = blockList.length
    while (blockList.length > 0) {
        let start = performance.now();

        const tmpList = blockList.splice(0, batch_size);
        const { results, errors } = await PromisePool
            .withConcurrency(n_workers)
            .for(tmpList)
            .process(async (height) => {
                if (await isBlockInDb(db, height)) {
                    return
                }

                let block: null | LavaBlock = null;
                block = await GetOneLavaBlock(height, client, clientTm, static_dbProviders, static_dbSpecs, static_dbPlans, static_dbStakes)
                if (block != null) {
                    await InsertBlock(block, db)
                } else {
                    console.log('failed getting block', height)
                }
            })

        let timeTaken = performance.now() - start;
        console.log(
            'work', org_len,
            'errors', errors,
            'batches remaining:', blockList.length / batch_size,
            'time', timeTaken / 1000,
            'est remaining:', Math.trunc((timeTaken / 1000) * blockList.length / batch_size), 's'
        )
        //
        // Add errors to global work list
        // to be tried again on the next iteration
        errors.forEach((err) => {
            globakWorkList.push(err.item)
        })
    }
}

interface ConnectionResult {
    client: StargateClient;
    clientTm: Tendermint37Client;
    chainId: string;
    height: number;
    lavajsClient: any;
}

// Define the backoffRetry function
const backoffRetry = async <T>(title: string, fn: () => Promise<T>): Promise<T> => {
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
                console.error(errorMessage);
            }
        }
    );
};

async function aggGetStartEnd(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        datehour: sql`DATE_TRUNC('hour', MAX(${schema.relayPayments.datetime}))`,
    }).from(schema.relayPayments)
        .then(rows => rows[0]?.datehour);

    if (!lastRelayPayment) {
        console.log("No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = lastRelayPayment as Date;

    // Last aggregated hour
    const lastAggHour = await db.select({
        datehour: sql`MAX(${schema.aggHourlyrelayPayments.datehour})`,
    }).from(schema.aggHourlyrelayPayments)
        .then(rows => rows[0]?.datehour);
    let startTime: Date;
    if (lastAggHour) {
        startTime = new Date(lastAggHour as string);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
    }

    console.log("aggGetStartEnd: startTime", startTime, "endTime", endTime);
    return { startTime, endTime };
}

async function updateAggHourlyPayments(db: PostgresJsDatabase) {
    const { startTime, endTime } = await aggGetStartEnd(db)
    console.log("updateAggHourlyPayments:", "startTime", startTime, "endTime", endTime)
    if (startTime === null || endTime === null) {
        console.log("updateAggHourlyPayments: startTime === null || endTime === null")
        return
    }
    if (startTime > endTime) {
        console.log("updateAggHourlyPayments: startTime > endTime")
        return
    }

    //
    const aggResults = await db.select({
        provider: sql`${schema.relayPayments.provider}`,
        datehour: sql`DATE_TRUNC('hour', ${schema.relayPayments.datetime}) as datehour`,
        specId: sql`${schema.relayPayments.specId}`,
        cuSum: sql`SUM(${schema.relayPayments.cu})`,
        relaySum: sql`SUM(${schema.relayPayments.relays})`,
        rewardSum: sql`SUM(${schema.relayPayments.pay})`,
        qosSyncAvg: sql`SUM(${schema.relayPayments.qosSync} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosAvailabilityAvg: sql`SUM(${schema.relayPayments.qosAvailability} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosLatencyAvg: sql`SUM(${schema.relayPayments.qosLatency} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosSyncExcAvg: sql`SUM(${schema.relayPayments.qosSyncExc} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosAvailabilityExcAvg: sql`SUM(${schema.relayPayments.qosAvailabilityExc} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosLatencyExcAvg: sql`SUM(${schema.relayPayments.qosLatencyExc} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
    }).from(schema.relayPayments)
        .where(
            sql`${schema.relayPayments.datetime} >= ${startTime}`
        )
        .groupBy(
            sql`datehour`,
            schema.relayPayments.provider,
            schema.relayPayments.specId
        )
        .orderBy(
            sql`datehour`,
        )
    if (aggResults.length === 0) {
        console.log("updateAggHourlyPayments:", "no agg results found")
        return;
    }
    console.log("aggResults.length", aggResults.length, aggResults[aggResults.length - 1])

    //
    // Update first the latest aggregate hour rows inserting
    // Note: the latest aggregate hour rows are partial (until updated post their hour)
    const latestHourData = aggResults.filter(r =>
        (new Date(r.datehour as string)).getTime() == startTime.getTime()
    );
    const remainingData = aggResults.filter(r =>
        (new Date(r.datehour as string)).getTime() > startTime.getTime()
    );
    await db.transaction(async (tx) => {
        for (const row of latestHourData) {
            await tx.update(schema.aggHourlyrelayPayments)
                .set({
                    cuSum: row.cuSum,
                    relaySum: row.relaySum,
                    rewardSum: row.rewardSum,
                    qosSyncAvg: row.qosSyncAvg,
                    qosAvailabilityAvg: row.qosAvailabilityAvg,
                    qosLatencyAvg: row.qosLatencyAvg,
                    qosSyncExcAvg: row.qosSyncExcAvg,
                    qosAvailabilityExcAvg: row.qosAvailabilityExcAvg,
                    qosLatencyExcAvg: row.qosLatencyExcAvg
                } as any)
                .where(
                    and(
                        sql`${schema.aggHourlyrelayPayments.datehour} = ${row.datehour}`,
                        sql`${schema.aggHourlyrelayPayments.provider} = ${row.provider}`,
                        sql`${schema.aggHourlyrelayPayments.specId} = ${row.specId}`
                    )
                )
        }

        //
        // Insert new rows
        if (remainingData.length === 0) {
            return;
        }
        await DoInChunks(250, remainingData, async (arr: any) => {
            await tx.insert(schema.aggHourlyrelayPayments)
                .values(arr)
        })
    })
}

async function connectToRpc(rpc: string): Promise<ConnectionResult> {
    const client = await StargateClient.connect(rpc);
    const clientTm = await Tendermint37Client.connect(rpc);
    const chainId = await client.getChainId();
    const height = await client.getHeight();
    const lavajsClient = await lavajs.lavanet.ClientFactory.createRPCQueryClient({ rpcEndpoint: rpc });
    console.log('chain', chainId, 'current height', height);

    return { client, clientTm, chainId, height, lavajsClient };
}

const indexer = async (): Promise<void> => {
    console.log(`starting indexer, rpc: ${rpc}, start height: ${lava_testnet2_start_height}`);

    const { client, clientTm, chainId, height, lavajsClient } =
        await backoffRetry<ConnectionResult>("connectToRpc", () => connectToRpc(rpc));

    console.log('chain', chainId, 'current height', height)

    //
    // DB
    await MigrateDb()
    let db = GetDb()

    //
    // Insert providers, specs & plans from latest block 
    await UpdateLatestBlockMeta(
        db,
        lavajsClient,
        height,
        false,
        static_dbProviders,
        static_dbSpecs,
        static_dbPlans,
        static_dbStakes
    )

    //
    // Loop forever, filling up blocks
    const loopFill = () => {
        console.log(`loopFill function called at: ${new Date().toISOString()}`);
        setTimeout(() => {
            fillUpBackoffRetry();
            console.log(`loopFill function finished at: ${new Date().toISOString()}`);
        }, poll_ms);
    }

    const fillUp = async () => {
        //
        // Blockchain latest
        let latestHeight = 0;
        try {
            latestHeight = await backoffRetry<number>("getHeight", async () => {
                return await client.getHeight();
            });
        } catch (e) {
            console.log('client.getHeight', e)
            loopFill()
            return
        }

        //
        // Find latest block on DB
        let dbHeight = lava_testnet2_start_height
        let latestDbBlock
        try {
            latestDbBlock = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
        } catch (e) {
            console.log('failed getting latestDbBlock', e)
            console.log('restarting db connection')
            db = GetDb()
            loopFill()
            return
        }
        if (latestDbBlock.length != 0) {
            const tHeight = latestDbBlock[0].height
            if (tHeight != null) {
                dbHeight = tHeight
            }
        }

        //
        // Found diff, start
        if (latestHeight > dbHeight) {
            console.log('db height', dbHeight, 'blockchain height', latestHeight)
            await doBatch(db, client, clientTm, dbHeight, latestHeight)

            //
            // Get the latest meta from RPC if not catching up
            // catching up = more than 1 block being indexed
            if (latestHeight - dbHeight == 1) {
                try {
                    await UpdateLatestBlockMeta(
                        db,
                        lavajsClient,
                        height,
                        true,
                        static_dbProviders,
                        static_dbSpecs,
                        static_dbPlans,
                        static_dbStakes
                    )
                } catch (e) {
                    console.log('UpdateLatestBlockMeta', e)
                }

                //
                try {
                    const start = Date.now();
                    await updateAggHourlyPayments(db);
                    console.log(`db.updateAggHourlyPayments execution time: ${Date.now() - start} ms`);
                } catch (e) {
                    console.log("update agg relay payments failed", e)
                }
            }
        }
        loopFill()
    }
    const fillUpBackoffRetry = async () => {
        try {
            await backoffRetry<void>("fillUp", async () => { await fillUp(); });
        } catch (e) {
            console.log('fillUpBackoffRetry error', e)
            loopFill()
            return
        }
    }
    fillUpBackoffRetry()
}

const indexerBackoffRetry = async () => {
    return await backoffRetry<void>("indexer", async () => { await indexer(); });
}

try {
    indexerBackoffRetry();
} catch (error) {
    if (error instanceof Error) {
        console.error('An error occurred while running the indexer:', error.message);
        console.error('Stack trace:', error.stack);
    } else {
        console.error('An unknown error occurred while running the indexer:', error);
    }
}