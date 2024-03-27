
// src/query/handlers/specHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, GetLatestBlock, QueryGetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { FormatDates } from '../dateUtils';

export const SpecHandlerOpts: RouteShorthandOptions = {
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
                }
            }
        }
    }
}

export async function SpecHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

    const { specId } = request.params as { specId: string }
    if (specId.length <= 0) {
        reply.code(400).send({ error: 'invalid specId' });
        return;
    }
    const upSpecId = specId.toUpperCase()

    //
    const res = await QueryGetReadDbInstance().select().from(schema.specs).where(eq(schema.specs.id, upSpecId)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'specId does not exist' });
        return;
    }
    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await QueryGetReadDbInstance().select({
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`
    }).from(schema.aggHourlyrelayPayments).where(eq(schema.aggHourlyrelayPayments.specId, upSpecId))
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    // Get stakes
    let res5 = await QueryGetReadDbInstance().select().from(schema.providerStakes).
        leftJoin(schema.providers, eq(schema.providerStakes.provider, schema.providers.address)).
        where(eq(schema.providerStakes.specId, upSpecId)).
        orderBy(desc(schema.providerStakes.stake))

    //
    // Get graph with 1 day resolution
    let res3 = await QueryGetReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`
    }).from(schema.aggHourlyrelayPayments).
        groupBy(sql`mydate`).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.specId, upSpecId)
            )
        ).
        orderBy(sql`mydate`)

    //
    // QoS graph
    let res6 = await QueryGetReadDbInstance().select({
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
                eq(schema.aggHourlyrelayPayments.specId, upSpecId)
            )
        ).groupBy(sql`mydate`).
        orderBy(sql`mydate`)

    return {
        height: latestHeight,
        datetime: latestDatetime,
        specId: res[0].id,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        qosData: FormatDates(res6),
        stakes: res5,
        data: FormatDates(res3),
    }
}
