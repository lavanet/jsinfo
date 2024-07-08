// src/indexer/agregators/aggConsumerHourlyRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isNotNull, sql, and } from "drizzle-orm";
import * as JsinfoSchema from "../../../schemas/jsinfoSchema/jsinfoSchema";
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { DoInChunks, logger } from "../../../utils";

export async function getConsumerAggHourlyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        datehour: sql<string>`DATE_TRUNC('hour', MAX(${JsinfoSchema.relayPayments.datetime}))`,
    }).from(JsinfoSchema.relayPayments)
        .then(rows => rows[0]?.datehour);

    if (!lastRelayPayment) {
        logger.error("getConsumerAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment);

    // Last aggregated hour
    const lastAggHour = await db.select({
        datehour: sql<string>`MAX(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour})`,
    }).from(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
        .then(rows => rows[0]?.datehour);
    let startTime: Date;
    if (lastAggHour) {
        startTime = new Date(lastAggHour);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
    }

    logger.info(`getConsumerAggHourlyTimeSpan: startTime ${startTime}, endTime ${endTime}`);
    return { startTime, endTime };
}

export async function aggConsumerHourlyRelayPayments(db: PostgresJsDatabase) {
    let { startTime, endTime } = await getConsumerAggHourlyTimeSpan(db);
    logger.info(`aggConsumerHourlyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggConsumerHourlyRelayPayments: startTime === null or endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggConsumerHourlyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    //
    const aggResults = await db.select({
        consumer: sql<string>`COALESCE(${JsinfoSchema.relayPayments.consumer}, '')`,
        datehour: sql<string>`CAST(DATE_TRUNC('hour', COALESCE(${JsinfoSchema.relayPayments.datetime}, CURRENT_TIMESTAMP)) AS TIMESTAMP) as datehour`,
        specId: sql<string>`COALESCE(${JsinfoSchema.relayPayments.specId}, '')`,
        cuSum: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.cu}, 0))`,
        relaySum: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0))`,
        rewardSum: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.pay}, 0))`,
        qosSyncAvg: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.qosSync}, 0) * COALESCE(${JsinfoSchema.relayPayments.relays}, 0)) / NULLIF(SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0)), 0)`,
        qosAvailabilityAvg: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.qosAvailability}, 0) * COALESCE(${JsinfoSchema.relayPayments.relays}, 0)) / NULLIF(SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0)), 0)`,
        qosLatencyAvg: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.qosLatency}, 0) * COALESCE(${JsinfoSchema.relayPayments.relays}, 0)) / NULLIF(SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0)), 0)`,
        qosSyncExcAvg: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.qosSyncExc}, 0) * COALESCE(${JsinfoSchema.relayPayments.relays}, 0)) / NULLIF(SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0)), 0)`,
        qosAvailabilityExcAvg: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.qosAvailabilityExc}, 0) * COALESCE(${JsinfoSchema.relayPayments.relays}, 0)) / NULLIF(SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0)), 0)`,
        qosLatencyExcAvg: sql<number>`SUM(COALESCE(${JsinfoSchema.relayPayments.qosLatencyExc}, 0) * COALESCE(${JsinfoSchema.relayPayments.relays}, 0)) / NULLIF(SUM(COALESCE(${JsinfoSchema.relayPayments.relays}, 0)), 0)`,
    }).from(JsinfoSchema.relayPayments)
        .where(
            and(
                sql`${JsinfoSchema.relayPayments.datetime} >= ${startTime}`,
                isNotNull(JsinfoSchema.relayPayments.consumer)
            )
        )
        .groupBy(
            sql`datehour`,
            JsinfoSchema.relayPayments.consumer,
            JsinfoSchema.relayPayments.specId
        )
        .orderBy(
            sql`datehour`,
        )
    if (aggResults.length === 0) {
        logger.error("aggConsumerHourlyRelayPayments: no agg results found")
        return;
    }



    // Define the type for the elements in aggResults array
    type AggResult = {
        consumer: string;
        datehour: string;
        specId: string;
        cuSum: number;
        relaySum: number;
        rewardSum: number;
        qosSyncAvg: number;
        qosAvailabilityAvg: number;
        qosLatencyAvg: number;
        qosSyncExcAvg: number;
        qosAvailabilityExcAvg: number;
        qosLatencyExcAvg: number;
    };

    // Explicitly type the uniqueCombinations map
    const uniqueCombinations = new Map<string, AggResult>();

    // Variable to store duplicates
    let duplicates: string[] = [];

    // Iterate over the aggResults to check for unique pairs of consumer, datehour, specId
    aggResults.forEach(result => {
        const key = `${result.consumer}-${result.datehour}-${result.specId}`;
        if (uniqueCombinations.has(key)) {
            // If the combination is already in the map, add it to duplicates
            const firstDuplicate = uniqueCombinations.get(key);
            duplicates.push(`Duplicate: ${JSON.stringify(result, null, 2)} | First occurrence: ${JSON.stringify(firstDuplicate)}\n`);
        } else {
            // Otherwise, add the combination to the map
            uniqueCombinations.set(key, result);
        }
    });

    // Check if there are any duplicates
    if (duplicates.length > 0) {
        // Log or throw an exception with the details of the duplicates
        logger.error(`Duplicate entries found for consumer, datehour, specId combinations: ${JSON.stringify(duplicates, null, 2)}`);
        throw new Error(`Duplicate entries found for consumer, datehour, specId combinations: ${JSON.stringify(duplicates, null, 2)}`);
    }

    //
    // Update first the latest aggregate hour rows inserting
    // Note: the latest aggregate hour rows are partial (until updated post their hour)
    const latestHourData = aggResults.filter(r =>
        (new Date(r.datehour)).getTime() == startTime!.getTime()
    );
    const remainingData = aggResults.filter(r =>
        (new Date(r.datehour)).getTime() > startTime!.getTime()
    );
    await db.transaction(async (tx) => {
        for (const row of latestHourData) {
            await tx.insert(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
                        target: [
                            JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour,
                            JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer,
                            JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.specId,
                        ],
                        set: {
                            cuSum: row.cuSum,
                            relaySum: row.relaySum,
                            rewardSum: row.rewardSum,
                            qosSyncAvg: row.qosSyncAvg,
                            qosAvailabilityAvg: row.qosAvailabilityAvg,
                            qosLatencyAvg: row.qosLatencyAvg,
                            qosSyncExcAvg: row.qosSyncExcAvg,
                            qosAvailabilityExcAvg: row.qosAvailabilityExcAvg,
                            qosLatencyExcAvg: row.qosLatencyExcAvg
                        } as any
                    }
                )
        }

        //
        // Insert new rows
        if (remainingData.length === 0) {
            return;
        }
        await DoInChunks(250, remainingData, async (arr: any) => {
            await tx.insert(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
                .values(arr)
        })
    })
}