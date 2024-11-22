// src/indexer/agregators/aggProviderHourlyRelayPayments.ts

import { queryJsinfo } from '@jsinfo/utils/db';
import { isNotNull, sql, and, ne } from "drizzle-orm";
import * as JsinfoSchema from "@jsinfo/schemas/jsinfoSchema/jsinfoSchema";
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { DoInChunks } from '@jsinfo/utils/processing';
import { logger } from '@jsinfo/utils/logger';
import { PgColumn } from 'drizzle-orm/pg-core';
import { HashJson } from '@jsinfo/utils/fmt';

export async function getProviderAggHourlyTimeSpan(): Promise<{ startTime: Date | null, endTime: Date | null }> {
    const lastRelayPayment = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                datehour: sql<string>`DATE_TRUNC('hour', MAX(${JsinfoSchema.relayPayments.datetime}))`,
            }).from(JsinfoSchema.relayPayments);
            return result[0];
        },
        'getProviderAggHourlyTimeSpan_lastPayment'
    );

    if (!lastRelayPayment?.datehour) {
        logger.error("getProviderAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = new Date(lastRelayPayment.datehour);

    const lastAggHour = await queryJsinfo(
        async (db) => {
            const result = await db.select({
                datehour: sql<string>`MAX(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour})`,
            }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments);
            return result[0];
        },
        'getProviderAggHourlyTimeSpan_lastAgg'
    );

    let startTime: Date = lastAggHour?.datehour
        ? new Date(lastAggHour.datehour)
        : new Date("2000-01-01T00:00:00Z");

    return { startTime, endTime };
}

export async function aggProviderHourlyRelayPayments() {
    let { startTime, endTime } = await getProviderAggHourlyTimeSpan();
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

    const aggResults = await queryJsinfo(
        async (db) => db.select({
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
            ),
        'aggProviderHourlyRelayPayments_select'
    );

    if (aggResults.length === 0) {
        logger.error("aggProviderHourlyRelayPayments: no agg results found");
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

    const latestHourData = aggResults.filter(r =>
        (new Date(r.datehour)).getTime() == startTime!.getTime()
    );
    const remainingData = aggResults.filter(r =>
        (new Date(r.datehour)).getTime() > startTime!.getTime()
    );

    await queryJsinfo(
        async (db) => {
            return db.transaction(async (tx) => {
                for (const row of latestHourData) {
                    await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                        .values(row as any)
                        .onConflictDoUpdate({
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
                        });
                }

                if (remainingData.length > 0) {
                    await DoInChunks(250, remainingData, async (arr: any) => {
                        await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                            .values(arr).onConflictDoNothing();
                    });
                }
                return {};
            });
        },
        `aggProviderHourlyRelayPayments_insert:${HashJson(aggResults)}`
    );
}