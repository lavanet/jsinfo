
// src/query/handlers/specHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { FormatDates } from '../utils/queryDateUtils';
import { ReplaceArchive } from '../../indexer/indexerUtils';

export const SpecCachedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: {
                        type: 'number'
                    },
                    datetime: {
                        type: 'number'
                    },
                    specId: {
                        type: 'string'
                    },
                    cuSum: {
                        type: 'number'
                    },
                    relaySum: {
                        type: 'number'
                    },
                    rewardSum: {
                        type: 'number'
                    },
                    stakes: {
                        type: 'array',
                    },
                    qosData: {
                        type: 'array'
                    },
                    data: {
                        type: 'array',
                    },
                    cuChartData: {
                        type: 'object',
                        additionalProperties: true,
                    }
                }
            }
        }
    }
}

export async function SpecCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { specId } = request.params as { specId: string }
    if (specId.length <= 0) {
        reply.code(400).send({ error: 'invalid specId' });
        return;
    }
    const upSpecId = specId.toUpperCase()

    //
    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.specs).where(eq(JsinfoSchema.specs.id, upSpecId)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'specId does not exist' });
        return;
    }
    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`
    }).from(JsinfoSchema.aggHourlyrelayPayments).where(eq(JsinfoSchema.aggHourlyrelayPayments.specId, upSpecId))
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    //
    // Get stakes
    let stakesRes = await QueryGetJsinfoReadDbInstance().select({
        stake: JsinfoSchema.providerStakes.stake,
        appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
        geolocation: JsinfoSchema.providerStakes.geolocation,
        // addons: JsinfoSchema.providerStakes.addons,
        // extensions: JsinfoSchema.providerStakes.extensions,
        addonsAndExtensions: sql<string>`TRIM(TRAILING ', ' FROM CASE 
            WHEN COALESCE(${JsinfoSchema.providerStakes.addons}, '') = '' AND COALESCE(${JsinfoSchema.providerStakes.extensions}, '') = '' THEN '-' 
            WHEN COALESCE(${JsinfoSchema.providerStakes.addons}, '') = '' THEN 'extensions: ' || ${JsinfoSchema.providerStakes.extensions}
            WHEN COALESCE(${JsinfoSchema.providerStakes.extensions}, '') = '' THEN 'addons: ' || ${JsinfoSchema.providerStakes.addons}
            ELSE 'addons: ' || ${JsinfoSchema.providerStakes.addons} || ', extensions: ' || ${JsinfoSchema.providerStakes.extensions} 
        END)`,
        status: JsinfoSchema.providerStakes.status,
        provider: JsinfoSchema.providerStakes.provider,
        moniker: JsinfoSchema.providers.moniker,
        specId: JsinfoSchema.providerStakes.specId,
        blockId: JsinfoSchema.providerStakes.blockId,
        cuSum: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.cuSum}, 0), 0))`,
        relaySum: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.relaySum}, 0), 0))`,
    }).from(JsinfoSchema.providerStakes)
        .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
        .leftJoin(JsinfoSchema.aggHourlyrelayPayments, and(
            eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.aggHourlyrelayPayments.provider),
            and(
                eq(JsinfoSchema.providerStakes.specId, JsinfoSchema.aggHourlyrelayPayments.specId),
                gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`)
            )
        ))
        .where(eq(JsinfoSchema.providerStakes.specId, upSpecId))
        .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId, JsinfoSchema.providers.moniker)
        .orderBy(desc(JsinfoSchema.providerStakes.stake))

    stakesRes = stakesRes
        .map(item => ({
            ...item,
            addonsAndExtensions: ReplaceArchive(item.addonsAndExtensions),
        }))
        .sort((a, b) => b.cuSum - a.cuSum);

    let top10Providers: { [key: string]: string } = stakesRes
        .slice(0, 10)
        .filter(item => item.provider)
        .reduce((acc, item) => ({
            ...acc,
            [item.provider || '']: item.moniker,
        }), {});

    //
    // Get graph with 1 day resolution
    let cuRelayAndRewardsGraphData = await QueryGetJsinfoReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
        cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        groupBy(sql`mydate`).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`),
                eq(JsinfoSchema.aggHourlyrelayPayments.specId, upSpecId)
            )
        ).
        orderBy(sql`mydate`)

    //
    // QoS graph
    let qosGraphData = await QueryGetJsinfoReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
        qosSyncAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosSyncAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosAvailabilityAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosLatencyAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosSyncExcAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosAvailabilityAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosLatencyExcAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`),
                eq(JsinfoSchema.aggHourlyrelayPayments.specId, upSpecId)
            )
        ).groupBy(sql`mydate`).
        orderBy(sql`mydate`)

    let cuChartResForTopProviders: { [key: string]: any } = {};

    for (let provider in top10Providers) {
        let data = await QueryGetJsinfoReadDbInstance().select({
            date: sql`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
            cuSum: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.cuSum}, 0), 0))`,
        }).from(JsinfoSchema.aggHourlyrelayPayments).
            groupBy(sql`mydate`).
            where(
                and(
                    gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`),
                    and(
                        eq(JsinfoSchema.aggHourlyrelayPayments.specId, upSpecId),
                        eq(JsinfoSchema.aggHourlyrelayPayments.provider, provider),
                    )
                )
            ).
            orderBy(sql`mydate`);

        let formattedData = FormatDates(data);

        // Use the moniker as the key if it is not null or empty
        let key = top10Providers[provider] ? top10Providers[provider] : provider;
        cuChartResForTopProviders[key] = formattedData;
    }

    return {
        height: latestHeight,
        datetime: latestDatetime,
        specId: res[0].id,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        qosData: FormatDates(qosGraphData),
        stakes: stakesRes,
        data: FormatDates(cuRelayAndRewardsGraphData),
        cuChartData: cuChartResForTopProviders,
    }
}
