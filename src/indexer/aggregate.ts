import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as JsinfoSchema from "../schemas/jsinfoSchema";
import { DoInChunks, logger } from "../utils";

export async function getAggHourlyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        datehour: sql`DATE_TRUNC('hour', MAX(${JsinfoSchema.relayPayments.datetime}))`,
    }).from(JsinfoSchema.relayPayments)
        .then(rows => rows[0]?.datehour);

    if (!lastRelayPayment) {
        logger.error("getAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = lastRelayPayment as Date;

    // Last aggregated hour
    const lastAggHour = await db.select({
        datehour: sql`MAX(${JsinfoSchema.aggHourlyrelayPayments.datehour})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments)
        .then(rows => rows[0]?.datehour);
    let startTime: Date;
    if (lastAggHour) {
        startTime = new Date(lastAggHour as string);
    } else {
        startTime = new Date("2000-01-01T00:00:00Z"); // Default start time if no data is found
    }

    logger.info(`getAggHourlyTimeSpan: startTime ${startTime}, endTime ${endTime}`);
    return { startTime, endTime };
}

export async function updateAggHourlyPayments(db: PostgresJsDatabase) {
    let { startTime, endTime } = await getAggHourlyTimeSpan(db)
    logger.info(`updateAggHourlyPayments: startTime ${startTime}, endTime ${endTime}`);
    if (startTime === null || endTime === null) {
        logger.error("updateAggHourlyPayments: startTime === null || endTime === null")
        return
    }
    if (startTime > endTime) {
        logger.error("updateAggHourlyPayments: startTime > endTime")
        return
    }

    //
    const aggResults = await db.select({
        provider: sql`${JsinfoSchema.relayPayments.provider}`,
        datehour: sql`DATE_TRUNC('hour', ${JsinfoSchema.relayPayments.datetime}) as datehour`,
        specId: sql`${JsinfoSchema.relayPayments.specId}`,
        cuSum: sql`SUM(${JsinfoSchema.relayPayments.cu})`,
        relaySum: sql`SUM(${JsinfoSchema.relayPayments.relays})`,
        rewardSum: sql`SUM(${JsinfoSchema.relayPayments.pay})`,
        qosSyncAvg: sql`SUM(${JsinfoSchema.relayPayments.qosSync} * ${JsinfoSchema.relayPayments.relays}) / SUM(${JsinfoSchema.relayPayments.relays})`,
        qosAvailabilityAvg: sql`SUM(${JsinfoSchema.relayPayments.qosAvailability} * ${JsinfoSchema.relayPayments.relays}) / SUM(${JsinfoSchema.relayPayments.relays})`,
        qosLatencyAvg: sql`SUM(${JsinfoSchema.relayPayments.qosLatency} * ${JsinfoSchema.relayPayments.relays}) / SUM(${JsinfoSchema.relayPayments.relays})`,
        qosSyncExcAvg: sql`SUM(${JsinfoSchema.relayPayments.qosSyncExc} * ${JsinfoSchema.relayPayments.relays}) / SUM(${JsinfoSchema.relayPayments.relays})`,
        qosAvailabilityExcAvg: sql`SUM(${JsinfoSchema.relayPayments.qosAvailabilityExc} * ${JsinfoSchema.relayPayments.relays}) / SUM(${JsinfoSchema.relayPayments.relays})`,
        qosLatencyExcAvg: sql`SUM(${JsinfoSchema.relayPayments.qosLatencyExc} * ${JsinfoSchema.relayPayments.relays}) / SUM(${JsinfoSchema.relayPayments.relays})`,
    }).from(JsinfoSchema.relayPayments)
        .where(
            sql`${JsinfoSchema.relayPayments.datetime} >= ${startTime}`
        )
        .groupBy(
            sql`datehour`,
            JsinfoSchema.relayPayments.provider,
            JsinfoSchema.relayPayments.specId
        )
        .orderBy(
            sql`datehour`,
        )
    if (aggResults.length === 0) {
        logger.error("updateAggHourlyPayments: no agg results found")
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
            await tx.insert(JsinfoSchema.aggHourlyrelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
                        target: [
                            JsinfoSchema.aggHourlyrelayPayments.datehour,
                            JsinfoSchema.aggHourlyrelayPayments.provider,
                            JsinfoSchema.aggHourlyrelayPayments.specId,
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
            await tx.insert(JsinfoSchema.aggHourlyrelayPayments)
                .values(arr)
        })
    })
}