
// src/query/handlers/providerHandler.ts

// curl http://localhost:8081/provider/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { FormatDates } from '../utils/queryDateUtils';

export const ProviderHandlerOpts: RouteShorthandOptions = {
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
                    qosData: {
                        type: 'array',
                    },
                    data: {
                        type: 'array',
                    },
                    claimableRewards: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

export async function ProviderHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    //
    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const provider = res[0]
    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    // Sums
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        where(eq(JsinfoSchema.aggHourlyrelayPayments.provider, addr)).
        groupBy(JsinfoSchema.aggHourlyrelayPayments.provider)
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    // Get stakes
    let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).
        where(eq(JsinfoSchema.providerStakes.provider, addr)).orderBy(desc(JsinfoSchema.providerStakes.stake))
    let stakeSum = 0
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake!
    })

    //
    // Get graph with 1 day resolution
    let data1 = await QueryGetJsinfoReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
        chainId: JsinfoSchema.aggHourlyrelayPayments.specId,
        cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(JsinfoSchema.aggHourlyrelayPayments.provider, addr)
            )
        ).
        groupBy(sql`${JsinfoSchema.aggHourlyrelayPayments.specId}`, sql`mydate`).
        orderBy(sql`mydate`)

    //
    // QoS graph
    let qosDataRaw = await QueryGetJsinfoReadDbInstance().select({
        date: sql`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
        qosSyncAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosSyncAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosAvailabilityAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosLatencyAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosSyncExcAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosAvailabilityAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosLatencyExcAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(JsinfoSchema.aggHourlyrelayPayments.provider, addr)
            )
        ).
        groupBy(sql`mydate`).
        orderBy(sql`mydate`)

    const rewards = await QueryGetJsinfoReadDbInstance().select()
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
    for (const reward of rewards) {
        const chainId = reward.chain_id;
        // Check if the current chain_id is already in maxRewardsByChainId with a newer timestamp
        if (!maxRewardsByChainId[chainId] || maxRewardsByChainId[chainId].timestamp < reward.timestamp) {
            maxRewardsByChainId[chainId] = reward;
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
        qosData: FormatDates(qosDataRaw),
        data: FormatDates(data1),
        claimableRewards: claimableRewardsULava,
    }
}