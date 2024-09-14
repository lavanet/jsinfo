// src/query/handlers/provider/providerCardsClaimableRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { and, desc, eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';

export const ProviderCardsClaimableRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    claimableRewards: { type: 'string' }
                }
            }
        }
    }
}

async function getClaimableRewards(addr: string): Promise<bigint> {
    const claimableRewards = await QueryGetJsinfoReadDbInstance()
        .select()
        .from(JsinfoSchema.dualStackingDelegatorRewards)
        .where(
            and(
                eq(JsinfoSchema.dualStackingDelegatorRewards.provider, addr),
                eq(JsinfoSchema.dualStackingDelegatorRewards.denom, 'ulava')
            )
        )
        .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp))
        .limit(200);

    let maxRewardsByChainId: Record<string, typeof JsinfoSchema.dualStackingDelegatorRewards.$inferSelect> = {};

    for (const claimableReward of claimableRewards) {
        const chainId = claimableReward.chainId;
        if (!maxRewardsByChainId[chainId] || maxRewardsByChainId[chainId].timestamp < claimableReward.timestamp) {
            maxRewardsByChainId[chainId] = claimableReward;
        }
    }

    let totalSum = 0n;
    for (const key in maxRewardsByChainId) {
        if (maxRewardsByChainId[key].denom === 'ulava') {
            totalSum += BigInt(maxRewardsByChainId[key].amount);
        }
    }

    return totalSum;
}

export async function ProviderCardsClaimableRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsClaimableRewards", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const totalSum = await getClaimableRewards(addr);

    const claimableRewardsULava = totalSum ? totalSum + ' ulava' : "0";

    return {
        claimableRewards: claimableRewardsULava
    };
}