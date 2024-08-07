// src/query/handlers/specHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, eq, count, and, gte } from "drizzle-orm";
import { GetAndValidateSpecIdFromRequest } from '../utils/queryUtils';
import { RedisCache } from '../classes/RedisCache';

export const SpecPaginatedHandlerOpts: RouteShorthandOptions = {
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
                    cacheHitRate: {
                        type: 'number'
                    },
                    endpointHealth: {
                        type: 'object',
                        properties: {
                            healthy: {
                                type: 'number'
                            },
                            unhealthy: {
                                type: 'number'
                            }
                        }
                    },
                }
            }
        }
    }
}

export async function SpecPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {

    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum})`,
    }).from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
        .where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId, spec))
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    let providerCount = await QueryGetJsinfoReadDbInstance().select({
        count: count()
    }).from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.specId, spec));

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const healthRecords = await QueryGetJsinfoReadDbInstance()
        .selectDistinctOn([JsinfoSchema.providerHealth.provider, JsinfoSchema.providerHealth.spec, JsinfoSchema.providerHealth.interface])
        .from(JsinfoSchema.providerHealth)
        .where(
            and(
                eq(JsinfoSchema.providerHealth.spec, spec),
                gte(JsinfoSchema.providerHealth.timestamp, twoDaysAgo)
            )
        )
        .limit(1000);

    const healthStatusCounts = { healthy: 0, unhealthy: 0 };

    healthRecords.forEach(({ status }) => {
        if (status === 'healthy') {
            healthStatusCounts.healthy += 1;
        } else {
            healthStatusCounts.unhealthy += 1;
        }
    });

    let cacheHitRate = 0.0;
    const cacheHitRateData = await RedisCache.getNoKeyPrefix("jsinfo-healthp-cachedmetrics") || {};
    const specUpper = spec.toUpperCase();
    if (cacheHitRateData[specUpper]) {
        cacheHitRate = cacheHitRateData[specUpper];
    }

    return {
        height: latestHeight,
        datetime: latestDatetime,
        specId: spec,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        providerCount: providerCount[0].count,
        endpointHealth: healthStatusCounts,
        cacheHitRate: cacheHitRate,
    }
}
