// src/indexer/agregators/aggConsumerAllTimeRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { logger } from "../../../utils";

export async function aggConsumerAllTimeRelayPayments(db: PostgresJsDatabase) {

    const aggResults = await db.select({
        consumer: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer}`,
        specId: sql<string>`${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId}`,
        cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.rewardSum})`,
        qosSyncAvg: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncAvg} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityAvg} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyAvg} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncExcAvg} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityExcAvg} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        qosLatencyExcAvg: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyExcAvg} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
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