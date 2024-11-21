// src/indexer/agregators/aggConsumerAllTimeRelayPayments.ts

import { queryJsinfo } from '../../../utils/db';
import { sql, ne } from "drizzle-orm";
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { logger } from "../../../utils/logger";
import { PgColumn } from 'drizzle-orm/pg-core';

export async function aggConsumerAllTimeRelayPayments() {

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum} ELSE 0 END)`;

    const aggResults = await queryJsinfo(
        async (db) => db.select({
            consumer: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer}`,
            specId: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId}`,
            cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.rewardSum})`,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyAvg),
            qosSyncExcAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncExcAvg),
            qosAvailabilityExcAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityExcAvg),
            qosLatencyExcAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyExcAvg),
        }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
            .groupBy(
                JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer,
                JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId
            ).where(ne(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum, 0)),
        'aggConsumerAllTimeRelayPayments_select'
    );

    if (aggResults.length === 0) {
        logger.error("aggConsumerDailyRelayPayments: no agg results found")
        return;
    }

    await queryJsinfo(
        async (db) => db.transaction(async (tx) => {
            for (const row of aggResults) {
                await tx.insert(JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments)
                    .values(row as any)
                    .onConflictDoUpdate(
                        {
                            target: [
                                JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.consumer,
                                JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.specId,
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
        }),
        'aggConsumerAllTimeRelayPayments_insert'
    );
}