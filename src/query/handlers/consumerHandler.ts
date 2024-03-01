
// src/query/handlers/consumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckDbInstance, GetDbInstance } from '../dbUtils';
import * as schema from '../../schema';
import { sql, desc, gt, and, eq } from "drizzle-orm";

export const ConsumerHandlerOpts: RouteShorthandOptions = {
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

export async function ConsumerHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider name' });
        return;
    }

    //
    const res = await GetDbInstance().select().from(schema.consumers).where(eq(schema.consumers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await GetDbInstance().select({
        cuSum: sql<number>`sum(${schema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${schema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${schema.relayPayments.pay})`
    }).from(schema.relayPayments).where(eq(schema.relayPayments.consumer, addr))
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    // Get graph with 1 day resolution
    let res5 = await GetDbInstance().select({
        date: sql<Date>`DATE(${schema.blocks.datetime})`,
        cuSum: sql<number>`sum(${schema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${schema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${schema.relayPayments.pay})`
    }).from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        groupBy(sql<Date>`DATE(${schema.blocks.datetime})`).
        where(and(
            gt(sql<Date>`DATE(${schema.blocks.datetime})`, sql<Date>`now() - interval '30 day'`),
            eq(schema.relayPayments.consumer, addr)
        )).
        orderBy(sql<Date>`DATE(${schema.blocks.datetime})`)

    //
    const res3 = await GetDbInstance().select().from(schema.conflictResponses).where(eq(schema.conflictResponses.consumer, addr)).
        orderBy(desc(schema.conflictResponses.id)).offset(0).limit(50)
    const res4 = await GetDbInstance().select().from(schema.subscriptionBuys).where(eq(schema.subscriptionBuys.consumer, addr)).
        orderBy(desc(schema.subscriptionBuys.blockId)).offset(0).limit(50)
    return {
        addr: addr,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        conflicts: res3,
        subsBuy: res4,
        data: res5,
    }
}