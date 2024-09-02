// src/indexer/agregators/aggProviderHourlyRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isNotNull, sql, and, ne } from "drizzle-orm";
import * as JsinfoSchema from "../../../schemas/jsinfoSchema/jsinfoSchema";
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { DoInChunks, logger } from "../../../utils/utils";
import { PgColumn } from 'drizzle-orm/pg-core';

export async function getProviderAggHourlyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        datehour: sql<string>`DATE_TRUNC('hour', MAX(${JsinfoSchema.relayPayments.datetime}))`,
    }).from(JsinfoSchema.relayPayments)
        .then(rows => rows[0]?.datehour);

    if (!lastRelayPayment) {
        logger.error("getProviderAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment);

    // Last aggregated hour
    const lastAggHour = await db.select({
        datehour: sql<string>`MAX(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour})`,
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
        .then(rows => rows[0]?.datehour);
    let startTime: Date;
    if (lastAggHour) {
        startTime = new Date(lastAggHour);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z");
    }

    logger.info(`getProviderAggHourlyTimeSpan: startTime ${startTime}, endTime ${endTime}`);
    return { startTime, endTime };
}

export async function aggProviderHourlyRelayPayments(db: PostgresJsDatabase) {
    let { startTime, endTime } = await getProviderAggHourlyTimeSpan(db);
    logger.info(`aggProviderHourlyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggProviderHourlyRelayPayments: startTime === null or endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggProviderHourlyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoSchema.relayPayments.relays}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoSchema.relayPayments.relays} ELSE 0 END)`;

    const aggResults = await db.select({
        provider: sql<string>`${JsinfoSchema.relayPayments.provider}`,
        datehour: sql<string>`DATE_TRUNC('hour', ${JsinfoSchema.relayPayments.datetime}) as datehour`,
        specId: sql<string>`${JsinfoSchema.relayPayments.specId}`,
        cuSum: sql<number>`SUM(${JsinfoSchema.relayPayments.cu})`,
        relaySum: sql<number>`SUM(${JsinfoSchema.relayPayments.relays})`,
        rewardSum: sql<number>`SUM(${JsinfoSchema.relayPayments.pay})`,
        qosSyncAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosSync),
        qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosAvailability),
        qosLatencyAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosLatency),
        qosSyncExcAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosSync),
        qosAvailabilityExcAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosAvailability),
        qosLatencyExcAvg: qosMetricWeightedAvg(JsinfoSchema.relayPayments.qosLatency),
    }).from(JsinfoSchema.relayPayments)
        .where(
            and(
                sql`${JsinfoSchema.relayPayments.datetime} >= ${startTime}`,
                isNotNull(JsinfoSchema.relayPayments.provider),
                ne(JsinfoSchema.relayPayments.relays, 0)
            )
        )
        .groupBy(
            sql`datehour`,
            JsinfoSchema.relayPayments.provider,
            JsinfoSchema.relayPayments.specId
        )
        .orderBy(
            sql`datehour`,
        )
    if (aggResults.length === 0) {
        logger.error("aggProviderHourlyRelayPayments: no agg results found")
        return;
    }

    const uniqueIdentifiers = new Set<string>();

    for (const result of aggResults) {
        const identifier = `${result.provider}-${result.datehour}-${result.specId}`;

        if (uniqueIdentifiers.has(identifier)) {
            throw new Error("Non-unique item found in aggResults by provider, datehour, and specId.");
        } else {
            uniqueIdentifiers.add(identifier);
        }
    }

    //
    // Update first the latest aggregate hour rows inserting
    // Note: the latest aggregate hour rows are partial (until updated post their hour)
    // console.log("aggResults:", aggResults);
    // console.log("startTime:", startTime);

    const latestHourData = aggResults.filter(r => {
        const rTime = (new Date(r.datehour)).getTime();
        // console.log("Checking for latestHourData - r.datehour:", r.datehour, "rTime:", rTime, "startTime:", startTime);
        return rTime == startTime!.getTime();
    });
    // console.log("latestHourData:", latestHourData);

    const remainingData = aggResults.filter(r => {
        const rTime = (new Date(r.datehour)).getTime();
        // console.log("Checking for remainingData - r.datehour:", r.datehour, "rTime:", rTime, "startTime:", startTime);
        return rTime > startTime!.getTime();
    });

    // console.log("remainingData:", remainingData);

    await db.transaction(async (tx) => {
        for (const row of latestHourData) {
            try {
                await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                    .values(row as any)
                    .onConflictDoUpdate(
                        {
                            target: [
                                JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour,
                                JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider,
                                JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId,
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
                    );
            } catch (error) {
                console.error('Error inserting row:', error);
                remainingData.push(row);
            }
        }

        if (remainingData.length === 0) {
            return;
        }
        await DoInChunks(250, remainingData, async (arr: any) => {
            await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                .values(arr).onConflictDoNothing();
        })
    })
}