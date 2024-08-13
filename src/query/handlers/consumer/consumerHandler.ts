
// src/query/handlers/ConsumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { GetAndValidateConsumerAddressFromRequest } from '../../utils/queryRequestArgParser';

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

    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }

    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.cuSum,
        relaySum: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.relaySum,
        rewardSum: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.rewardSum,
    }).from(JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments)
        .where(eq(JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.consumer, addr))
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum || 0
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum || 0
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum || 0
    }

    let graphDataRet = await QueryGetJsinfoReadDbInstance().select({
        date: JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday,
        cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.rewardSum})`
    }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments).
        groupBy(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday).
        where(and(
            gt(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`),
            eq(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer, addr)
        )).
        orderBy(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday)

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
        data: graphDataRet,
    }
}