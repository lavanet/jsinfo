// src/indexer/agregators/aggProviderHourlyRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isNotNull, sql, and } from "drizzle-orm";
import * as JsinfoSchema from "../../../schemas/jsinfoSchema/jsinfoSchema";
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { DoInChunks, logger } from "../../../utils";

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
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
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

    //
    const aggResults = await db.select({
        provider: sql<string>`${JsinfoSchema.relayPayments.provider}`,
        datehour: sql<string>`DATE_TRUNC('hour', ${JsinfoSchema.relayPayments.datetime}) as datehour`,
        specId: sql<string>`${JsinfoSchema.relayPayments.specId}`,
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
                isNotNull(JsinfoSchema.relayPayments.provider)
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
                )
        }

        //
        // Insert new rows
        if (remainingData.length === 0) {
            return;
        }
        await DoInChunks(250, remainingData, async (arr: any) => {
            await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                .values(arr)
        })
    })
}