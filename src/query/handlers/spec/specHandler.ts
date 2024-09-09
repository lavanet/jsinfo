// src/query/handlers/specHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, eq, count, and, gte, inArray } from "drizzle-orm";
import { GetAndValidateSpecIdFromRequest } from '../../utils/queryRequestArgParser';
import { RedisCache } from '../../classes/RedisCache';

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
    const startTime = performance.now();

    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    // console.log(`GetLatestBlock completed at ${new Date().toISOString()}. Time taken: ${(performance.now() - startTime).toFixed(2)}ms`);

    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum})`,
    }).from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
        .where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId, spec))

    // console.log(`cuRelayAndRewardsTotalRes query completed at ${new Date().toISOString()}. Time taken: ${(performance.now() - startTime).toFixed(2)}ms`);

    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    // console.log(`cuRelayAndRewardsTotalRes query completed at ${new Date().toISOString()}. Time taken: ${(performance.now() - startTime).toFixed(2)}ms`);

    let providerCount = await QueryGetJsinfoReadDbInstance().select({
        count: count()
    }).from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.specId, spec));

    // console.log(`providerCount query completed at ${new Date().toISOString()}. Time taken: ${(performance.now() - startTime).toFixed(2)}ms`);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Step 1: Get the latest IDs for each provider-spec-interface combination
    const latestIdsQuery = QueryGetJsinfoReadDbInstance()
        .select({
            provider: JsinfoSchema.providerHealth.provider,
            spec: JsinfoSchema.providerHealth.spec,
            interface: JsinfoSchema.providerHealth.interface,
            maxId: sql<number>`MAX(${JsinfoSchema.providerHealth.id})`.as('max_id'),
        })
        .from(JsinfoSchema.providerHealth)
        .where(
            and(
                eq(JsinfoSchema.providerHealth.spec, spec),
                gte(JsinfoSchema.providerHealth.timestamp, twoDaysAgo)
            )
        )
        .groupBy(
            JsinfoSchema.providerHealth.provider,
            JsinfoSchema.providerHealth.spec,
            JsinfoSchema.providerHealth.interface
        );

    const latestIds = await latestIdsQuery;
    // console.log("Latest IDs:", latestIds);

    // Step 2: Get the health status for the latest records
    const healthStatusQuery = QueryGetJsinfoReadDbInstance()
        .select({
            id: JsinfoSchema.providerHealth.id,
            provider: JsinfoSchema.providerHealth.provider,
            spec: JsinfoSchema.providerHealth.spec,
            interface: JsinfoSchema.providerHealth.interface,
            status: JsinfoSchema.providerHealth.status,
            timestamp: JsinfoSchema.providerHealth.timestamp,
        })
        .from(JsinfoSchema.providerHealth)
        .where(
            inArray(JsinfoSchema.providerHealth.id, latestIds.map(li => li.maxId))
        );

    // console.log("Health status query SQL:", healthStatusQuery.toSQL());
    const healthStatus = await healthStatusQuery;
    // console.log("Health status:", healthStatus);

    // Step 3: Count healthy and unhealthy records
    const healthyCount = healthStatus.filter(hs => hs.status === 'healthy').length;
    const unhealthyCount = healthStatus.length - healthyCount;

    const healthStatusCounts = {
        healthy: healthyCount,
        unhealthy: unhealthyCount
    };

    // console.log("Health status counts:", healthStatusCounts);

    let cacheHitRate = 0.0;
    const cacheHitRateData = await RedisCache.getDictNoKeyPrefix("jsinfo-healthp-cachedmetrics") || {};
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
