// src/query/handlers/spec/specV2Handlers.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, eq, count, and, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { GetAndValidateSpecIdFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { queryJsinfo } from '@jsinfo/utils/db';
import { SpecProviderHealthResource } from '@jsinfo/redis/resources/spec/SpecProviderHealthResource';
import { WriteErrorToFastifyReplyNoLog } from '@jsinfo/query/utils/queryServerUtils';
import { ProviderStakesAndDelegationService } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';

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

    // Use the same data source as SpecStakesV2Handler to ensure 100% consistency
    // This ensures the count matches exactly what's shown in the provider list
    try {
        const allStakesData = await ProviderStakesAndDelegationService.fetch();
        
        if (!allStakesData || !allStakesData.detailedSpecStakes) {
            // Fallback to database query if cached data is not available
            const providerRows = await queryJsinfo<{ provider: string | null; specId: string | null }[]>(
                async (db) => await db.select({
                    provider: JsinfoSchema.providerStakes.provider,
                    specId: JsinfoSchema.providerStakes.specId,
                })
                    .from(JsinfoSchema.providerStakes)
                    .where(
                        and(
                            eq(JsinfoSchema.providerStakes.specId, spec),
                            isNotNull(JsinfoSchema.providerStakes.provider),
                            ne(JsinfoSchema.providerStakes.provider, ''),
                            isNotNull(JsinfoSchema.providerStakes.specId),
                            ne(JsinfoSchema.providerStakes.specId, '')
                        )
                    ),
                'SpecProviderCount_getProviders_fallback'
            );

            // Count distinct providers
            const validProviders = new Set<string>();
            for (const row of providerRows) {
                if (row.provider && row.specId) {
                    validProviders.add(row.provider);
                }
            }
            return { providerCount: validProviders.size };
        }

        // Get stakes for this spec (same data source as SpecStakesV2Handler)
        const specStakes = allStakesData.detailedSpecStakes[spec] || [];
        
        // Count distinct providers
        const providerSet = new Set<string>();
        for (const stake of specStakes) {
            if (stake.provider) {
                providerSet.add(stake.provider);
            }
        }

        return { providerCount: providerSet.size };
    } catch (error) {
        // Fallback to simple database count if there's an error
        const providerCount = await queryJsinfo<{ count: number }[]>(
            async (db) => await db.select({ count: count() })
                .from(JsinfoSchema.providerStakes)
                .where(
                    and(
                        eq(JsinfoSchema.providerStakes.specId, spec),
                        isNotNull(JsinfoSchema.providerStakes.provider),
                        ne(JsinfoSchema.providerStakes.provider, ''),
                        isNotNull(JsinfoSchema.providerStakes.specId),
                        ne(JsinfoSchema.providerStakes.specId, '')
                    )
                ),
            'SpecProviderCount_getCount_fallback'
        );

        return { providerCount: providerCount[0]?.count || 0 };
    }
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

    const sphr = new SpecProviderHealthResource();
    const healthRecords = await sphr.fetch({ spec });

    if (!healthRecords || healthRecords.length === 0) {
        WriteErrorToFastifyReplyNoLog(reply, 'No recent health records for spec');
        return null;
    }

    // Group health records by provider
    const providerHealthMap = new Map<string, boolean>();
    
    healthRecords.forEach(record => {
        if (!record.provider) return; // Skip records without provider
        
        const currentStatus = providerHealthMap.get(record.provider);
        // If provider already marked as healthy, keep it healthy
        // Otherwise, update with current interface status
        if (currentStatus !== true) {
            providerHealthMap.set(record.provider, record.status === 'healthy');
        }
    });
    
    // Count healthy and unhealthy providers
    let healthyCount = 0;
    let unhealthyCount = 0;
    
    providerHealthMap.forEach(isHealthy => {
        if (isHealthy) {
            healthyCount++;
        } else {
            unhealthyCount++;
        }
    });

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