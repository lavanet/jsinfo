
// src/query/handlers/providerHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetLatestBlock, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { FormatDates } from '../dateUtils';

export const ProviderHandlerOpts: RouteShorthandOptions = {
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
                    addr: {
                        type: 'string'
                    },
                    moniker: {
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
                    stakeSum: {
                        type: 'number',
                    },
                    events: {
                        type: 'array',
                    },
                    stakes: {
                        type: 'array',
                    },
                    payments: {
                        type: 'array',
                    },
                    reports: {
                        type: 'array',
                    },
                    qosData: {
                        type: 'array',
                    },
                    data: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function ProviderHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    //
    const res = await GetReadDbInstance().select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const provider = res[0]
    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    // Sums
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await GetReadDbInstance().select({
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(eq(schema.aggHourlyrelayPayments.provider, addr)).
        groupBy(schema.aggHourlyrelayPayments.provider)
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    // Get stakes
    let stakesRes = await GetReadDbInstance().select().from(schema.providerStakes).
        where(eq(schema.providerStakes.provider, addr)).orderBy(desc(schema.providerStakes.stake))
    let stakeSum = 0
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake!
    })

    //
    // Get graph with 1 day resolution
    let data1 = await GetReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        chainId: schema.aggHourlyrelayPayments.specId,
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.provider, addr)
            )
        ).
        groupBy(sql`${schema.aggHourlyrelayPayments.specId}`, sql`mydate`).
        orderBy(sql`mydate`)

    //
    // QoS graph
    let qosDataRaw = await GetReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        qosSyncAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.provider, addr)
            )
        ).
        groupBy(sql`mydate`).
        orderBy(sql`mydate`)


    return {
        height: latestHeight,
        datetime: latestDatetime,
        addr: provider.address,
        moniker: provider.moniker,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        qosData: FormatDates(qosDataRaw),
        data: FormatDates(data1),
    }
}