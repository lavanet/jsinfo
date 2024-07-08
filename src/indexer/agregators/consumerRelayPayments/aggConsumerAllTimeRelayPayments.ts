// src/indexer/agregators/aggConsumerAllTimeRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { logger } from "../../../utils";

export async function aggConsumerAllTimeRelayPayments(db: PostgresJsDatabase) {

    const aggResults = await db.select({
        consumer: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer}`,
        specId: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId}`,
        cuSum: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.cuSum}, 0))`,
        relaySum: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0))`,
        rewardSum: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.rewardSum}, 0))`,
        qosSyncAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)), 0)`,
        qosSyncExcAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncExcAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)), 0)`,
        qosAvailabilityExcAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityExcAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)), 0)`,
        qosLatencyExcAvg: sql<number>`SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyExcAvg}, 0) * COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)) / NULLIF(SUM(COALESCE(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}, 0)), 0)`,
    }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
        .groupBy(
            JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer,
            JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId
        )
    if (aggResults.length === 0) {
        logger.error("aggConsumerDailyRelayPayments: no agg results found")
        return;
    }

    await db.transaction(async (tx) => {
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
    })
}