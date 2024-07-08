// src/indexer/agregators/aggProviderAllTimeRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { logger } from "../../../utils";

export async function aggProviderAllTimeRelayPayments(db: PostgresJsDatabase) {

    const aggResults = await db.select({
        provider: sql<string>`${JsinfoProviderAgrSchema.aggDailyRelayPayments.provider}`,
        specId: sql<string>`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`,
        cuSum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}, 0))`,
        relaySum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0))`,
        rewardSum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.rewardSum}, 0))`,
        qosSyncAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)), 0)`,
        qosSyncExcAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncExcAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityExcAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityExcAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyExcAvg: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyExcAvg}, 0) * COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0)), 0)`,
    }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
        .groupBy(
            JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            JsinfoProviderAgrSchema.aggDailyRelayPayments.specId
        )
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