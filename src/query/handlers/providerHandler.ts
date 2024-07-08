
// src/query/handlers/providerHandler.ts

// curl http://localhost:8081/provider/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, and, eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';

export const ProviderPaginatedHandlerOpts: RouteShorthandOptions = {
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
                    addr: {
                        type: 'string'
                    },
                    moniker: {
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
                    stakeSum: {
                        type: 'number',
                    },
                    events: {
                        type: 'array',
                    },
                    stakes: {
                        type: 'array',
                    },
                    payments: {
                        type: 'array',
                    },
                    reports: {
                        type: 'array',
                    },
                    claimedRewards: {
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

export async function ProviderPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        WriteErrorToFastifyReply(reply, 'Provider does not exist')
        return reply;
    }

    const provider = res[0]
    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    // Sums
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const cuRelayAndRewardsTotalRes = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum})`,
    }).from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments).
        where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider, addr)).
        groupBy(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider)
    if (cuRelayAndRewardsTotalRes.length == 1) {
        cuSum = cuRelayAndRewardsTotalRes[0].cuSum
        relaySum = cuRelayAndRewardsTotalRes[0].relaySum
        rewardSum = cuRelayAndRewardsTotalRes[0].rewardSum
    }

    //
    // Get stakes
    let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).
        where(eq(JsinfoSchema.providerStakes.provider, addr)).orderBy(desc(JsinfoSchema.providerStakes.stake))
    let stakeSum = 0
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake!
    })

    const claimedRewards = await QueryGetJsinfoReadDbInstance().select()
        .from(JsinfoSchema.events)
        .where(
            and(
                eq(JsinfoSchema.events.provider, addr),
                eq(JsinfoSchema.events.eventType, JsinfoSchema.LavaProviderEventType.DelegateToProvider)
            )
        )

    let claimedRewardsSum = 0;

    for (let i = 0; i < claimedRewards.length; i++) {
        const reward = claimedRewards[i];

        if (reward.b1 !== null && reward.b1 !== 0) {
            claimedRewardsSum += reward.b1;
        } else if (reward.t3 !== null && reward.t3.toLowerCase().endsWith('ulava')) {
            claimedRewardsSum += Number(reward.t3.slice(0, -5));
        }
    }

    let claimedRewardsSumULava = claimedRewardsSum ? claimedRewardsSum + ' ulava' : 0;

    const claimableRewards = await QueryGetJsinfoReadDbInstance().select()
        .from(JsinfoSchema.dualStackingDelegatorRewards)
        .where(
            and(
                eq(JsinfoSchema.dualStackingDelegatorRewards.provider, addr),
                eq(JsinfoSchema.dualStackingDelegatorRewards.denom, 'ulava')
            )
        )
        .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp))
        .limit(200);

    let maxRewardsByChainId = {};

    // Iterate over the fetched rewards to find the latest entry per chain_id
    for (const claimableReward of claimableRewards) {
        const chainId = claimableReward.chainId;
        // Check if the current chain_id is already in maxRewardsByChainId with a newer timestamp
        if (!maxRewardsByChainId[chainId] || maxRewardsByChainId[chainId].timestamp < claimableReward.timestamp) {
            maxRewardsByChainId[chainId] = claimableReward;
        }
    }

    // Filter to keep only entries with denom "ulava" and sum amounts
    let totalSum = 0;
    for (const key in maxRewardsByChainId) {
        if (maxRewardsByChainId[key].denom === 'ulava') {
            totalSum += maxRewardsByChainId[key].amount;
        }
    }

    const claimableRewardsULava = totalSum ? totalSum + ' ulava' : 0;

    return {
        height: latestHeight,
        datetime: latestDatetime,
        addr: provider.address,
        moniker: provider.moniker,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        claimedRewards: claimedRewardsSumULava,
        claimableRewards: claimableRewardsULava,
    }
}