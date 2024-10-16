
// src/query/handlers/consumer/consumerV2Handler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPayments';
import { eq, sql } from "drizzle-orm";
import { GetAndValidateConsumerAddressFromRequest } from '../../utils/queryRequestArgParser';

export const ConsumerV2CahcedHandlerOpts: RouteShorthandOptions = {
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
                }
            }
        }
    }
}

export async function ConsumerV2CahcedHandler(request: FastifyRequest, reply: FastifyReply) {

    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }

    await QueryCheckJsinfoReadDbInstance()

    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0

    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggTotalConsumerRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggTotalConsumerRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggTotalConsumerRelayPayments.rewardSum})`,
    }).from(JsinfoConsumerAgrSchema.aggTotalConsumerRelayPayments)
        .where(eq(JsinfoConsumerAgrSchema.aggTotalConsumerRelayPayments.consumer, addr))

    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum || 0
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum || 0
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum || 0
    }

    return {
        addr: addr,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
    }
}