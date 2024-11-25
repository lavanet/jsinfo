// src/query/handlers/spec/specV2Handlers.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, eq, count, and, gte, inArray } from "drizzle-orm";
import { GetAndValidateSpecIdFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { queryJsinfo } from '@jsinfo/utils/db';

// Spec CU, Relay, and Rewards Handler
export const SpecCuRelayRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum: { type: 'number' },
                    relaySum: { type: 'number' },
                    rewardSum: { type: 'number' }
                }
            }
        }
    }
}

export async function SpecCuRelayRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const cuRelayAndRewardsTotalRes = await queryJsinfo<{ cuSum: number; relaySum: number; rewardSum: number }[]>(
        async (db) => await db.select({
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum})`,
        })
            .from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
            .where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId, spec)),
        'SpecCuRelayRewards_getTotals'
    );

    return cuRelayAndRewardsTotalRes[0] || { cuSum: 0, relaySum: 0, rewardSum: 0 };
}

// Spec Provider Count Handler
export const SpecProviderCountHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    providerCount: { type: 'number' }
                }
            }
        }
    }
}

export async function SpecProviderCountHandler(request: FastifyRequest, reply: FastifyReply) {
    const spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const providerCount = await queryJsinfo<{ count: number }[]>(
        async (db) => await db.select({ count: count() })
            .from(JsinfoSchema.providerStakes)
            .where(eq(JsinfoSchema.providerStakes.specId, spec)),
        'SpecProviderCount_getCount'
    );

    return { providerCount: providerCount[0].count };
}

// Spec Endpoint Health Handler
export const SpecEndpointHealthHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    endpointHealth: {
                        type: 'object',
                        properties: {
                            healthy: { type: 'number' },
                            unhealthy: { type: 'number' }
                        }
                    }
                }
            }
        }
    }
}

export async function SpecEndpointHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    const spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    ;

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const latestIds = await queryJsinfo<{ provider: string | null; spec: string; interface: string | null; maxId: number }[]>(
        async (db) => await db.select({
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
            ),
        'SpecEndpointHealth_getLatestIds'
    );

    if (latestIds.length === 0) {
        return {
            endpointHealth: {
                healthy: 0,
                unhealthy: 0
            }
        };
    }

    const maxIds = latestIds.map(li => li.maxId);

    const healthStatus = await queryJsinfo<{ id: number; status: string }[]>(
        async (db) => await db.select({
            id: JsinfoSchema.providerHealth.id,
            status: JsinfoSchema.providerHealth.status,
        })
            .from(JsinfoSchema.providerHealth)
            .where(inArray(JsinfoSchema.providerHealth.id, maxIds)),
        'SpecEndpointHealth_getHealthStatus'
    );

    const healthyCount = healthStatus.filter(hs => hs.status === 'healthy').length;
    const unhealthyCount = healthStatus.length - healthyCount;

    return {
        endpointHealth: {
            healthy: healthyCount,
            unhealthy: unhealthyCount
        }
    };
}

export const SpecCacheHitRateHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cacheHitRate: { type: 'number' }
                }
            }
        }
    }
}

export async function SpecCacheHitRateHandler(request: FastifyRequest, reply: FastifyReply) {
    const spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const cacheHitRateData = await RedisCache.getDictNoKeyPrefix("jsinfo-healthp-cachedmetrics") || {};
    const specUpper = spec.toUpperCase();
    const cacheHitRate = cacheHitRateData[specUpper] || 0.0;

    return { cacheHitRate };
}

// Spec Tracked Info Sum Handler
export const SpecTrackedInfoHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum: { type: 'string' }
                }
            }
        }
    }
}

export async function SpecTrackedInfoHandler(request: FastifyRequest, reply: FastifyReply) {
    const spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const result = await queryJsinfo<{ cuSum: string }[]>(
        async (db) => await db.select({
            cuSum: sql<string>`SUM(${JsinfoSchema.specTrackedInfo.iprpc_cu}::numeric)`
        })
            .from(JsinfoSchema.specTrackedInfo)
            .where(eq(JsinfoSchema.specTrackedInfo.chain_id, spec)),
        'SpecTrackedInfo_getCuSum'
    );

    return { cuSum: result[0]?.cuSum || '0' };
}