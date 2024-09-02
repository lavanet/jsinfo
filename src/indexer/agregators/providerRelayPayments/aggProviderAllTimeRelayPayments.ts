// src/indexer/agregators/aggProviderAllTimeRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, ne } from "drizzle-orm";
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { logger } from "../../../utils/utils";
import { PgColumn } from 'drizzle-orm/pg-core';

export async function aggProviderAllTimeRelayPayments(db: PostgresJsDatabase) {

    const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

    const aggResults = await db.select({
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
        ).where(ne(JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum, 0))

    if (aggResults.length === 0) {
        logger.error("aggDailyRelayPayments: no agg results found")
        return;
    }

    await db.transaction(async (tx) => {
        for (const row of aggResults) {
            await tx.insert(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
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
                    }
                )
        }
    })
}