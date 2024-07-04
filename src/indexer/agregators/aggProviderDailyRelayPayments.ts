// src/indexer/agregators/aggProviderHourlyRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as JsinfoSchema from "../../schemas/jsinfoSchema/jsinfoSchema";
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { DoInChunks, logger } from "../../utils";

export async function getProviderAggHourlyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        datehour: sql`DATE_TRUNC('day', MAX(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour}))`,
    }).from(JsinfoSchema.relayPayments)
        .then(rows => rows[0]?.datehour);

    if (!lastRelayPayment) {
        logger.error("getProviderAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = lastRelayPayment as Date;

    // Last aggregated hour
    const lastAggHour = await db.select({
        datehour: sql`MAX(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour})`,
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
        .then(rows => rows[0]?.datehour);
    let startTime: Date;
    if (lastAggHour) {
        startTime = new Date(lastAggHour as string);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
    }

    logger.info(`getProviderAggHourlyTimeSpan: startTime ${startTime}, endTime ${endTime}`);
    return { startTime, endTime };
}

export async function aggProviderHourlyRelayPayments(db: PostgresJsDatabase) {
    let { startTime, endTime } = await getProviderAggHourlyTimeSpan(db)
    logger.info(`aggProviderHourlyRelayPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error("aggProviderHourlyRelayPayments: startTime === null || endTime === null")
        return
    }
    if (startTime > endTime) {
        logger.error("aggProviderHourlyRelayPayments: startTime > endTime")
        return
    }

    //
    const aggResults = await db.select({
        provider: sql`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider}`,
        datehour: sql`DATE_TRUNC('day', ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour}) as datehour`,
        specId: sql`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId}`,
        cuSum: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.cuSum})`,
        relaySum: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        rewardSum: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.rewardSum})`,
        qosSyncAvg: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosSyncAvg} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        qosAvailabilityAvg: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosAvailabilityAvg} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        qosLatencyAvg: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosLatencyAvg} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        qosSyncExcAvg: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosSyncExcAvg} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosAvailabilityExcAvg} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        qosLatencyExcAvg: sql`SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.qosLatencyExcAvg} * ${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum}) / SUM(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
        .where(
            sql`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour} >= ${startTime}`
        )
        .groupBy(
            sql`datehour`,
            JsinfoProviderAgrSchema.aggHourlyRelayPayments.provider,
            JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId
        )
        .orderBy(
            sql`datehour`,
        )
    if (aggResults.length === 0) {
        logger.error("aggProviderHourlyRelayPayments: no agg results found")
        return;
    }

    //
    // Update first the latest aggregate hour rows inserting
    // Note: the latest aggregate hour rows are partial (until updated post their hour)
    const latestHourData = aggResults.filter(r =>
        (new Date(r.datehour as string)).getTime() == startTime!.getTime()
    );
    const remainingData = aggResults.filter(r =>
        (new Date(r.datehour as string)).getTime() > startTime!.getTime()
    );
    await db.transaction(async (tx) => {
        for (const row of latestHourData) {
            await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
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
                    }
                )
        }

        //
        // Insert new rows
        if (remainingData.length === 0) {
            return;
        }
        await DoInChunks(250, remainingData, async (arr: any) => {
            await tx.insert(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
                .values(arr)
        })
    })
}