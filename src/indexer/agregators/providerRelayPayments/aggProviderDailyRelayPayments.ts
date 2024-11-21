// src/indexer/agregators/aggProviderDailyRelayPayments.ts

import { queryJsinfo } from '@jsinfo/utils/db';
import { isNotNull, sql, and, ne } from "drizzle-orm";
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { DoInChunks } from '@jsinfo/utils/processing';
import { logger } from '@jsinfo/utils/logger';
import { PgColumn } from 'drizzle-orm/pg-core';

export async function getProviderAggDailyTimeSpan(): Promise<{ startTime: Date | null, endTime: Date | null }> {
    const lastRelayPayment = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                dateday: sql<string>`DATE_TRUNC('day', MAX(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour}))`,
            }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments);
            return result[0];
        },
        'getProviderAggDailyTimeSpan_lastPayment'
    );

    if (!lastRelayPayment) {
        logger.error("getProviderAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment.dateday);

    const lastAggDay = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                dateday: sql<string>`MAX(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`,
            }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments);
            return result[0];
        },
        'getProviderAggDailyTimeSpan_lastAgg'
    );

    let startTime: Date = lastAggDay
        ? new Date(lastAggDay.dateday)
        : new Date("2000-01-01T00:00:00Z");

    return { startTime, endTime };
}

export async function aggProviderDailyRelayPayments() {
    let { startTime, endTime } = await getProviderAggDailyTimeSpan();
    logger.info(`aggProviderDailyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggProviderDailyRelayPayments: startTime === null || endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggProviderDailyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum} ELSE 0 END)`;

    const aggResults = await queryJsinfo(
        async (db) => db.select({
            provider: sql<string>`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider}`,
            dateday: sql<string>`DATE_TRUNC('day', ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour}) as dateday`,
            specId: sql<string>`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId}`,
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.rewardSum})`,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosLatencyAvg),
            qosSyncExcAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosSyncExcAvg),
            qosAvailabilityExcAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosAvailabilityExcAvg),
            qosLatencyExcAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosLatencyExcAvg),
        }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
            .where(
                and(
                    sql`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour} >= ${startTime}`,
                    isNotNull(JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider),
                    ne(JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum, 0)
                )
            )
            .groupBy(
                sql`dateday`,
                JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider,
                JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId
            )
            .orderBy(
                sql`dateday`,
            ),
        'aggProviderDailyRelayPayments_aggResults'
    );

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
    await queryJsinfo(
        async (db) => {
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
            });
            return { success: true };
        },
        'aggProviderDailyRelayPayments_update'
    );
}