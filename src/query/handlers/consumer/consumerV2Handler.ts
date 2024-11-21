// src/query/handlers/consumer/consumerV2Handler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { eq, sql } from "drizzle-orm";
import { GetAndValidateConsumerAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { queryJsinfo } from '@jsinfo/utils/db';

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



    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0

    const cuRelayAndRewardsTotalRes = await queryJsinfo<{ cuSum: number; relaySum: number; rewardSum: number }[]>(
        async (db) => await db.select({
            cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.rewardSum})`,
        })
            .from(JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments)
            .where(eq(JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.consumer, addr)),
        'ConsumerV2_getTotals'
    );

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