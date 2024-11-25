// src/indexer/agregators/aggConsumerHourlyRelayPayments.ts

import { queryJsinfo } from '@jsinfo/utils/db';
import { isNotNull, sql, and, ne } from "drizzle-orm";
import * as JsinfoSchema from "@jsinfo/schemas/jsinfoSchema/jsinfoSchema";
import * as JsinfoConsumerAgrSchema from '@jsinfo/schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { DoInChunks } from '@jsinfo/utils/processing';
import { logger } from '@jsinfo/utils/logger';
import { PgColumn } from 'drizzle-orm/pg-core';
import { HashJson } from '@jsinfo/utils/fmt';

export async function getConsumerAggHourlyTimeSpan(): Promise<{ startTime: Date | null, endTime: Date | null }> {
    const lastRelayPayment = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                datehour: sql<string>`DATE_TRUNC('hour', MAX(${JsinfoSchema.relayPayments.datetime}))`,
            }).from(JsinfoSchema.relayPayments);
            return result[0];
        },
        'getConsumerAggHourlyTimeSpan_lastPayment'
    );

    if (!lastRelayPayment) {
        logger.error("getConsumerAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment.datehour);

    const lastAggHour = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                datehour: sql<string>`MAX(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour})`,
            }).from(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments);
            return result[0];
        },
        'getConsumerAggHourlyTimeSpan_lastAgg'
    );

    let startTime: Date = lastAggHour
        ? new Date(lastAggHour.datehour)
        : new Date("2000-01-01T00:00:00Z");

    return { startTime, endTime };
}

export async function aggConsumerHourlyRelayPayments() {
    let { startTime, endTime } = await getConsumerAggHourlyTimeSpan();
    logger.info(`aggConsumerHourlyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggConsumerHourlyRelayPayments: startTime === null or endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggConsumerHourlyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoSchema.relayPayments.relays}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoSchema.relayPayments.relays} ELSE 0 END)`;

    const aggResults = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                consumer: sql<string>`${JsinfoSchema.relayPayments.consumer}`,
                datehour: sql<string>`DATE_TRUNC('day', ${JsinfoSchema.relayPayments.datetime}) as datehour`,
                specId: sql<string>`${JsinfoSchema.relayPayments.specId}`,
                cuSum: sql<number>`SUM(${JsinfoSchema.relayPayments.cu})`,
                relaySum: sql<number>`SUM(${JsinfoSchema.relayPayments.relays})`,
                rewardSum: sql<number>`SUM(${JsinfoSchema.relayPayments.pay})`,
                qosSyncAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosSync),
                qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosAvailability),
                qosLatencyAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosLatency),
                qosSyncExcAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosSyncExc),
                qosAvailabilityExcAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosAvailabilityExc),
                qosLatencyExcAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosLatencyExc),
            }).from(JsinfoSchema.relayPayments)
                .where(
                    and(
                        sql`${JsinfoSchema.relayPayments.datetime} >= ${startTime}`,
                        isNotNull(JsinfoSchema.relayPayments.consumer),
                        ne(JsinfoSchema.relayPayments.relays, 0)
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
            return result;
        },
        `aggConsumerHourlyRelayPayments_${startTime}_${endTime}`
    );

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
    await queryJsinfo(
        async (db) => db.transaction(async (tx) => {
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

            if (remainingData.length === 0) {
                return { success: true };
            }

            await DoInChunks(250, remainingData, async (arr: any) => {
                await tx.insert(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
                    .values(arr)
            })
            return { success: true };
        }),
        `aggConsumerHourlyRelayPayments_update:${HashJson(aggResults)}`
    );
}