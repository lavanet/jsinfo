
// src/query/handlers/specHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { sql, eq, count } from "drizzle-orm";
import { GetAndValidateSpecIdFromRequest } from '../utils/queryUtils';

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
                    providerCount: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function SpecCachedHandler(request: FastifyRequest, reply: FastifyReply) {

    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).where(eq(JsinfoSchema.aggHourlyrelayPayments.specId, spec))
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    let providerCount = await QueryGetJsinfoReadDbInstance().select({
        count: count()
    }).from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.specId, spec));

    return {
        height: latestHeight,
        datetime: latestDatetime,
        specId: spec,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        providerCount: providerCount[0].count
    }
}
