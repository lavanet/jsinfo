// src/indexer/agregators/aggConsumerDailyRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isNotNull, sql, and } from "drizzle-orm";
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { DoInChunks, logger } from "../../../utils";

export async function getConsumerAggDailyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        dateday: sql<string>`DATE_TRUNC('day', MAX(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour}))`,
    }).from(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
        .then(rows => rows[0]?.dateday);

    if (!lastRelayPayment) {
        logger.error("getConsumerAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment);

    // Last aggregated day
    const lastAggDay = await db.select({
        dateday: sql<string>`MAX(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday})`,
    }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
        .then(rows => rows[0]?.dateday);
    let startTime: Date;
    if (lastAggDay) {
        startTime = new Date(lastAggDay);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
    }

    logger.info(`getConsumerAggDailyTimeSpan: startTime ${startTime}, endTime ${endTime}`);
    return { startTime, endTime };
}

export async function aggConsumerDailyRelayPayments(db: PostgresJsDatabase) {
    let { startTime, endTime } = await getConsumerAggDailyTimeSpan(db)
    logger.info(`aggConsumerDailyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggConsumerDailyRelayPayments: startTime === null || endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggConsumerDailyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    //
    const aggResults = await db.select({
        consumer: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer}`,
        dateday: sql<string>`DATE_TRUNC('day', ${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour}) as dateday`,
        specId: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.specId}`,
        cuSum: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.cuSum}, 0))`,
        relaySum: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0))`,
        rewardSum: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.rewardSum}, 0))`,
        qosSyncAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosSyncAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosAvailabilityAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosLatencyAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosSyncExcAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosSyncExcAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityExcAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosAvailabilityExcAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyExcAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosLatencyExcAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}, 0)), 0)`,
    }).from(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
        .where(
            and(
                sql`${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour} >= ${startTime}`,
                isNotNull(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer)
            )
        )
        .groupBy(
            sql`dateday`,
            JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer,
            JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.specId
        )
        .orderBy(
            sql`dateday`,
        )
    if (aggResults.length === 0) {
        logger.error("aggConsumerDailyRelayPayments: no agg results found")
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
            await tx.insert(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
                        target: [
                            JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday,
                            JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer,
                            JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId,
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
            await tx.insert(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
                .values(arr)
        })
    })
}