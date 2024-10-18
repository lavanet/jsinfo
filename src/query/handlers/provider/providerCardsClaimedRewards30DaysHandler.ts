// src/query/handlers/provider/providerCardsClaimedRewards30DaysHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { sql, and, eq, gte, isNotNull } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { ProviderRewardsCache } from '../../classes/QueryProviderRewardsCache';

export const ProviderCardsClaimedRewards30DaysHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    claimedRewards30DaysAgo: { type: 'string' }
                }
            }
        }
    }
}

async function getClaimedRewards30Days(addr: string): Promise<bigint> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const claimedRewards30DaysAgo = await QueryGetJsinfoReadDbInstance()
        .select({
            rewardSum: sql<bigint>`COALESCE(SUM(${JsinfoSchema.events.b1}), 0) as rewardSum`
        })
        .from(JsinfoSchema.events)
        .where(
            and(
                eq(JsinfoSchema.events.provider, addr),
                eq(JsinfoSchema.events.eventType, JsinfoSchema.LavaProviderEventType.DelegatorClaimRewards),
                isNotNull(JsinfoSchema.events.timestamp),
                gte(JsinfoSchema.events.timestamp, thirtyDaysAgo)
            )
        );

    const claimedRewards30DaysAgoSum = claimedRewards30DaysAgo.length ? BigInt(claimedRewards30DaysAgo[0].rewardSum) : 0n;
    const cachedRewards30Days = ProviderRewardsCache.getRewardsLast30Days()[addr] || 0n;
    return claimedRewards30DaysAgoSum + cachedRewards30Days;
}

export async function ProviderCardsClaimedRewards30DaysHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsClaimedRewards30Days", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const claimedRewards30DaysAgoSum = await getClaimedRewards30Days(addr);

    const claimedRewards30DaysAgoSumULava = claimedRewards30DaysAgoSum ? claimedRewards30DaysAgoSum + ' ulava' : "0";

    return {
        claimedRewards30DaysAgo: claimedRewards30DaysAgoSumULava
    };
}