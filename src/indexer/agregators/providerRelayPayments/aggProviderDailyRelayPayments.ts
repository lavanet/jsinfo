// src/indexer/agregators/aggProviderDailyRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isNotNull, sql, and } from "drizzle-orm";
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { DoInChunks, logger } from "../../../utils";

export async function getProviderAggDailyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        dateday: sql<string>`DATE_TRUNC('day', MAX(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour}))`,
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
        .then(rows => rows[0]?.dateday);

    if (!lastRelayPayment) {
        logger.error("getProviderAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment);

    // Last aggregated day
    const lastAggDay = await db.select({
        dateday: sql<string>`MAX(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`,
    }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
        .then(rows => rows[0]?.dateday);
    let startTime: Date;
    if (lastAggDay) {
        startTime = new Date(lastAggDay);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
    }

    logger.info(`getProviderAggDailyTimeSpan: startTime ${startTime}, endTime ${endTime}`);
    return { startTime, endTime };
}

export async function aggProviderDailyRelayPayments(db: PostgresJsDatabase) {
    let { startTime, endTime } = await getProviderAggDailyTimeSpan(db)
    logger.info(`aggProviderDailyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggProviderDailyRelayPayments: startTime === null || endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggProviderDailyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    //
    const aggResults = await db.select({
        provider: sql<string>`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider}`,
        dateday: sql<string>`DATE_TRUNC('day', ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour}) as dateday`,
        specId: sql<string>`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId}`,
        cuSum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.cuSum}, 0))`,
        relaySum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0))`,
        rewardSum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.rewardSum}, 0))`,
        qosSyncAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosSyncAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosAvailabilityAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosLatencyAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosSyncExcAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosSyncExcAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityExcAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosAvailabilityExcAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyExcAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosLatencyExcAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}, 0)), 0)`,
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
        .where(
            and(
                sql`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour} >= ${startTime}`,
                isNotNull(JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider)
            )
        )
        .groupBy(
            sql`dateday`,
            JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider,
            JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId
        )
        .orderBy(
            sql`dateday`,
        )
    if (aggResults.length === 0) {
        logger.error("aggProviderDailyRelayPayments: no agg results found")
        return;
    }

    //
    // Update first the latest aggregate hour rows inserting
    // Note: the latest aggregate hour rows are partial (until updated post their hour)
    const latestHourData = aggResults.filter(r =>
        (new Date(r.dateday)).getTime() == startTime!.getTime()
    );
    const remainingData = aggResults.filter(r =>
        (new Date(r.dateday)).getTime() > startTime!.getTime()
    );
    await db.transaction(async (tx) => {
        for (const row of latestHourData) {
            await tx.insert(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
                        target: [
                            JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
                            JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                            JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
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
            await tx.insert(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .values(arr)
        })
    })
}