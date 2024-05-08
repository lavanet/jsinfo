
// src/query/handlers/ConsumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, gt, and, eq } from "drizzle-orm";

export const ConsumerCahcedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    addr: {
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
                    conflicts: {
                        type: 'array'
                    },
                    subsBuy: {
                        type: 'array'
                    },
                    data: {
                        type: 'array'
                    }
                }
            }
        }
    }
}

export async function ConsumerCahcedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider name' });
        return;
    }

    //
    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.consumers).where(eq(JsinfoSchema.consumers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return reply;
    }

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`sum(${JsinfoSchema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${JsinfoSchema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.relayPayments.pay})`
    }).from(JsinfoSchema.relayPayments).where(eq(JsinfoSchema.relayPayments.consumer, addr))
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    //
    // Get graph with 1 day resolution
    let graphDatRet = await QueryGetJsinfoReadDbInstance().select({
        date: sql<Date>`DATE(${JsinfoSchema.blocks.datetime})`,
        cuSum: sql<number>`sum(${JsinfoSchema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${JsinfoSchema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.relayPayments.pay})`
    }).from(JsinfoSchema.relayPayments).
        leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height)).
        groupBy(sql<Date>`DATE(${JsinfoSchema.blocks.datetime})`).
        where(and(
            gt(sql<Date>`DATE(${JsinfoSchema.blocks.datetime})`, sql<Date>`now() - interval '30 day'`),
            eq(JsinfoSchema.relayPayments.consumer, addr)
        )).
        orderBy(sql<Date>`DATE(${JsinfoSchema.blocks.datetime})`)

    //
    const conflictsRet = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.conflictResponses).where(eq(JsinfoSchema.conflictResponses.consumer, addr)).
        orderBy(desc(JsinfoSchema.conflictResponses.id)).offset(0).limit(50)
    const subsBuyRet = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.subscriptionBuys).where(eq(JsinfoSchema.subscriptionBuys.consumer, addr)).
        orderBy(desc(JsinfoSchema.subscriptionBuys.blockId)).offset(0).limit(50)

    return {
        addr: addr,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        conflicts: conflictsRet,
        subsBuy: subsBuyRet,
        data: graphDatRet,
    }
}