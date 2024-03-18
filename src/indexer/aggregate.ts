import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import { DoInChunks, logger } from "../utils";

export async function getAggHourlyTimeSpan(db: PostgresJsDatabase): Promise<{ startTime: Date | null, endTime: Date | null }> {
    // Last relay payment time
    const lastRelayPayment = await db.select({
        datehour: sql`DATE_TRUNC('hour', MAX(${schema.relayPayments.datetime}))`,
    }).from(schema.relayPayments)
        .then(rows => rows[0]?.datehour);

    if (!lastRelayPayment) {
        logger.error("getAggHourlyTimeSpan: No relay payments found");
        return { startTime: null, endTime: null };
    }
    const endTime = lastRelayPayment as Date;

    // Last aggregated hour
    const lastAggHour = await db.select({
        datehour: sql`MAX(${schema.aggHourlyrelayPayments.datehour})`,
    }).from(schema.aggHourlyrelayPayments)
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
        provider: sql`${schema.relayPayments.provider}`,
        datehour: sql`DATE_TRUNC('hour', ${schema.relayPayments.datetime}) as datehour`,
        specId: sql`${schema.relayPayments.specId}`,
        cuSum: sql`SUM(${schema.relayPayments.cu})`,
        relaySum: sql`SUM(${schema.relayPayments.relays})`,
        rewardSum: sql`SUM(${schema.relayPayments.pay})`,
        qosSyncAvg: sql`SUM(${schema.relayPayments.qosSync} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosAvailabilityAvg: sql`SUM(${schema.relayPayments.qosAvailability} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosLatencyAvg: sql`SUM(${schema.relayPayments.qosLatency} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosSyncExcAvg: sql`SUM(${schema.relayPayments.qosSyncExc} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosAvailabilityExcAvg: sql`SUM(${schema.relayPayments.qosAvailabilityExc} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
        qosLatencyExcAvg: sql`SUM(${schema.relayPayments.qosLatencyExc} * ${schema.relayPayments.relays}) / SUM(${schema.relayPayments.relays})`,
    }).from(schema.relayPayments)
        .where(
            sql`${schema.relayPayments.datetime} >= ${startTime}`
        )
        .groupBy(
            sql`datehour`,
            schema.relayPayments.provider,
            schema.relayPayments.specId
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
            await tx.insert(schema.aggHourlyrelayPayments)
                .values(row as any)
                .onConflictDoUpdate(
                    {
                        target: [
                            schema.aggHourlyrelayPayments.datehour,
                            schema.aggHourlyrelayPayments.provider,
                            schema.aggHourlyrelayPayments.specId,
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
            await tx.insert(schema.aggHourlyrelayPayments)
                .values(arr)
        })
    })
}