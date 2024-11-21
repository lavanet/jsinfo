// src/indexer/agregators/aggProviderAllTimeRelayPayments.ts

import { queryJsinfo } from '@jsinfo/utils/db';
import { sql, ne } from "drizzle-orm";
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { logger } from "../../../utils/logger";
import { PgColumn } from 'drizzle-orm/pg-core';

export async function aggProviderAllTimeRelayPayments() {

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

    const aggResults = await queryJsinfo(
        async (db) => db.select({
            provider: sql<string>`${JsinfoProviderAgrSchema.aggDailyRelayPayments.provider}`,
            specId: sql<string>`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`,
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.rewardSum})`,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg),
            qosSyncExcAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncExcAvg),
            qosAvailabilityExcAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityExcAvg),
            qosLatencyExcAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyExcAvg),
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(
                JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                JsinfoProviderAgrSchema.aggDailyRelayPayments.specId
            ).where(ne(JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum, 0)),
        'aggProviderAllTimeRelayPayments_select'
    );

    if (aggResults.length === 0) {
        logger.error("aggDailyRelayPayments: no agg results found")
        return;
    }

    await queryJsinfo(
        async (db) => db.transaction(async (tx) => {
            for (const row of aggResults) {
                await tx.insert(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
                    .values(row as any)
                    .onConflictDoUpdate({
                        target: [
                            JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider,
                            JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId,
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
                    })
            }
        }),
        'aggProviderAllTimeRelayPayments_insert'
    );
}