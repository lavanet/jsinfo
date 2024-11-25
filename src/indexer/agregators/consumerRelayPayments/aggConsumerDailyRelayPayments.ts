// src/indexer/agregators/aggConsumerDailyRelayPayments.ts

import { queryJsinfo } from '@jsinfo/utils/db';
import { isNotNull, sql, and, ne } from "drizzle-orm";
import * as JsinfoConsumerAgrSchema from '@jsinfo/schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { DoInChunks } from '@jsinfo/utils/processing';
import { logger } from '@jsinfo/utils/logger';
import { PgColumn } from 'drizzle-orm/pg-core';
import { HashJson } from '@jsinfo/utils/fmt';

export async function getConsumerAggDailyTimeSpan(): Promise<{ startTime: Date | null, endTime: Date | null }> {
    const lastRelayPayment = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                dateday: sql<string>`DATE_TRUNC('day', MAX(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour}))`,
            }).from(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments);
            return { dateday: result[0]?.dateday };
        },
        'getConsumerAggDailyTimeSpan_lastRelayPayment'
    );

    if (!lastRelayPayment) {
        logger.error("getConsumerAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment.dateday);

    const lastAggDay = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                dateday: sql<string>`MAX(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday})`,
            }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments);
            return { dateday: result[0]?.dateday };
        },
        'getConsumerAggDailyTimeSpan_lastAggDay'
    );

    let startTime: Date = lastAggDay?.dateday
        ? new Date(lastAggDay.dateday)
        : new Date("2000-01-01T00:00:00Z");

    return { startTime, endTime };
}

export async function aggConsumerDailyRelayPayments() {
    let { startTime, endTime } = await getConsumerAggDailyTimeSpan();
    logger.info(`aggConsumerDailyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error(`aggConsumerDailyRelayPayments: startTime === null || endTime === null. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }
    if (startTime > endTime) {
        logger.error(`aggConsumerDailyRelayPayments: startTime > endTime. Received startTime: ${startTime}, endTime: ${endTime}`);
        return;
    }

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum} ELSE 0 END)`;

    const aggResults = await queryJsinfo(
        async (db) => db.select({
            consumer: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer}`,
            dateday: sql<string>`DATE_TRUNC('day', ${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour}) as dateday`,
            specId: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.specId}`,
            cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.rewardSum})`,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosLatencyAvg),
            qosSyncExcAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosSyncExcAvg),
            qosAvailabilityExcAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosAvailabilityExcAvg),
            qosLatencyExcAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.qosLatencyExcAvg),
        }).from(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments)
            .where(
                and(
                    sql`${JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.datehour} >= ${startTime}`,
                    isNotNull(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer),
                    ne(JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.relaySum, 0)
                )
            )
            .groupBy(
                sql`dateday`,
                JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.consumer,
                JsinfoConsumerAgrSchema.aggConsumerHourlyRelayPayments.specId
            )
            .orderBy(
                sql`dateday`,
            ),
        `aggConsumerDailyRelayPayments_select_${startTime}_${endTime}`
    );

    if (aggResults.length === 0) {
        logger.error("aggConsumerDailyRelayPayments: no agg results found");
        return;
    }

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
                    await tx.insert(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
                        .values(row as any)
                        .onConflictDoUpdate({
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
                        });
                }

                if (remainingData.length > 0) {
                    await DoInChunks(250, remainingData, async (arr: any) => {
                        await tx.insert(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
                            .values(arr);
                    });
                }
            });
            return { success: true };
        },
        `aggConsumerDailyRelayPayments_insert:${HashJson(aggResults)}`
    );
}