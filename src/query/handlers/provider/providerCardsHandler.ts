
// src/query/handlers/ProviderCardsHandler.ts

// curl http://localhost:8081/provider/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, and, eq, gte, isNotNull, like } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { JSONStringifySpaced, logger, MinBigInt, ParseUlavaToBigInt } from '../../../utils/utils';
import { ProviderRewardsCache } from '../../classes/ProviderRewardsCache';

export const ProviderCardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum: {
                        type: 'number'
                    },
                    relaySum: {
                        type: 'number'
                    },
                    rewardSum: {
                        type: 'number'
                    },
                    stakeSum: {
                        type: 'string',
                    },
                    claimedRewardsAllTime: {
                        type: 'string'
                    },
                    claimedRewards30DaysAgo: {
                        type: 'string'
                    },
                    claimableRewards: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

// {"claimed":"141991ibc/21E6274EDD0A68821E6C2FD4B243DF85EB86FF19920FF35FC18E68939DDE87CB,15253022710ulava","delegator":"lava@1fpprhv40h9z058ez0hxdattjvg0fjsrhkqc7cu"}
// http://localhost:5100/provider/lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99#health

async function getCuRelayAndRewardsTotal(addr: string) {
    const result = await QueryGetJsinfoReadDbInstance()
        .select({
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum})`,
        })
        .from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
        .where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider, addr))
        .groupBy(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider);

    if (result.length === 1) {
        return {
            cuSum: result[0].cuSum,
            relaySum: result[0].relaySum,
            rewardSum: result[0].rewardSum
        };
    }

    return { cuSum: 0, relaySum: 0, rewardSum: 0 };
}

async function getStakes(addr: string) {
    const stakesRes = await QueryGetJsinfoReadDbInstance()
        .select()
        .from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.provider, addr))
        .orderBy(desc(JsinfoSchema.providerStakes.stake));

    let stakeSum = 0n;
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake! + MinBigInt(stake.delegateTotal, stake.delegateLimit);
    });

    return stakeSum;
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
    const cachedRewards = ProviderRewardsCache.getAllRewards()[addr] || 0n;
    return claimedRewardsAllTimeSum + cachedRewards;
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

    let maxRewardsByChainId: any = {};

    for (const claimableReward of claimableRewards) {
        const chainId = claimableReward.chainId;
        if (!maxRewardsByChainId[chainId] || maxRewardsByChainId[chainId].timestamp < claimableReward.timestamp) {
            maxRewardsByChainId[chainId] = claimableReward;
        }
    }

    let totalSum = 0n;
    for (const key in maxRewardsByChainId) {
        if (maxRewardsByChainId[key].denom === 'ulava') {
            totalSum += maxRewardsByChainId[key].amount;
        }
    }

    return totalSum;
}

export async function ProviderCardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCards", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const [cuRelayRewards, stakeSum, claimedRewardsAllTimeSum, claimedRewards30DaysAgoSum, totalSum] = await Promise.all([
        getCuRelayAndRewardsTotal(addr),
        getStakes(addr),
        getClaimedRewards(addr),
        getClaimedRewards30Days(addr),
        getClaimableRewards(addr)
    ]);

    const { cuSum, relaySum, rewardSum } = cuRelayRewards;

    const claimableRewardsULava = totalSum ? totalSum + ' ulava' : "0";
    const claimedRewardsAllTimeSumULava = claimedRewardsAllTimeSum ? claimedRewardsAllTimeSum + ' ulava' : "0";
    const claimedRewards30DaysAgoSumULava = claimedRewards30DaysAgoSum ? claimedRewards30DaysAgoSum + ' ulava' : "0";

    return {
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum.toString(),
        claimedRewards: 0,
        claimableRewards: claimableRewardsULava,
        claimedRewardsAllTime: claimedRewardsAllTimeSumULava,
        claimedRewards30DaysAgo: claimedRewards30DaysAgoSumULava
    };
}