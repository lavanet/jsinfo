// src/indexer/agregators/aggProviderAllTimeRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { logger } from "../../../utils";

export async function aggProviderAllTimeRelayPayments(db: PostgresJsDatabase) {

    const aggResults = await db.select({
        provider: sql<string>`${JsinfoProviderAgrSchema.aggDailyRelayPayments.provider}`,
        specId: sql<string>`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`,
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.rewardSum})`,
        qosSyncAvg: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncExcAvg} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityExcAvg} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        qosLatencyExcAvg: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyExcAvg} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
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