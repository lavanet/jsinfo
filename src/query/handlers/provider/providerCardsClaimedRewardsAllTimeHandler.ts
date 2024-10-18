
// src/query/handlers/provider/providerCardsClaimedRewardsAllTimeHandler.ts

// curl http://localhost:8081/provider/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { sql, and, eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { ProviderRewardsCache } from '../../classes/QueryProviderRewardsCache';

export const ProviderCardsClaimedRewardsAllTimeHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    claimedRewardsAllTime: {
                        type: 'string'
                    },
                }
            }
        }
    }
}

async function getClaimedRewards(addr: string): Promise<bigint> {
    const claimedRewardsAllTime = await QueryGetJsinfoReadDbInstance()
        .select({
            rewardSum: sql<bigint>`COALESCE(SUM(${JsinfoSchema.events.b1}), 0) as rewardSum`
        })
        .from(JsinfoSchema.events)
        .where(
            and(
                eq(JsinfoSchema.events.provider, addr),
                eq(JsinfoSchema.events.eventType, JsinfoSchema.LavaProviderEventType.DelegatorClaimRewards)
            )
        );

    const claimedRewardsAllTimeSum = claimedRewardsAllTime.length ? BigInt(claimedRewardsAllTime[0].rewardSum) : 0n;
    if (typeof ProviderRewardsCache.getAllRewards()[addr] == 'bigint') {
        return claimedRewardsAllTimeSum + ProviderRewardsCache.getAllRewards()[addr];
    }
    return claimedRewardsAllTimeSum;
}

export async function ProviderCardsClaimedRewardsAllTimeHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsClaimedRewardsAllTime", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const claimedRewardsAllTimeSum = await getClaimedRewards(addr);
    const claimedRewardsAllTimeSumULava = claimedRewardsAllTimeSum ? claimedRewardsAllTimeSum + ' ulava' : "0";

    return {
        claimedRewardsAllTime: claimedRewardsAllTimeSumULava,
    };
}