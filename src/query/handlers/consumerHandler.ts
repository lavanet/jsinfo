
// src/query/handlers/ConsumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { GetAndValidateConsumerAddressFromRequest } from '../utils/queryUtils';

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
    // TODO: this is slow - this should use aggHourlyrelayPayments
    console.log("QueryCheckJsinfoReadDbInstance start");
    await QueryCheckJsinfoReadDbInstance()
    console.log("QueryCheckJsinfoReadDbInstance end");

    console.log("GetAndValidateConsumerAddressFromRequest start");
    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    console.log("GetAndValidateConsumerAddressFromRequest end with addr:", addr);
    if (addr === '') {
        console.log("Address is empty, returning reply");
        return reply;
    }

    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    console.log("QueryGetJsinfoReadDbInstance for cuRelayAndRewardsTotal start");
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`sum(${JsinfoSchema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${JsinfoSchema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.relayPayments.pay})`
    }).from(JsinfoSchema.relayPayments).where(eq(JsinfoSchema.relayPayments.consumer, addr))
    console.log("QueryGetJsinfoReadDbInstance for cuRelayAndRewardsTotal end");
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    console.log("QueryGetJsinfoReadDbInstance for graph data start");
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
    console.log("QueryGetJsinfoReadDbInstance for graph data end");

    console.log("QueryGetJsinfoReadDbInstance for conflictsRet start");
    const conflictsRet = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.conflictResponses).where(eq(JsinfoSchema.conflictResponses.consumer, addr)).
        orderBy(desc(JsinfoSchema.conflictResponses.id)).offset(0).limit(50)
    console.log("QueryGetJsinfoReadDbInstance for conflictsRet end");

    console.log("QueryGetJsinfoReadDbInstance for subsBuyRet start");
    const subsBuyRet = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.subscriptionBuys).where(eq(JsinfoSchema.subscriptionBuys.consumer, addr)).
        orderBy(desc(JsinfoSchema.subscriptionBuys.blockId)).offset(0).limit(50)
    console.log("QueryGetJsinfoReadDbInstance for subsBuyRet end");

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