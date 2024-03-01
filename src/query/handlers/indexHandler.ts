// src/query/handlers/indexHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckDbInstance, GetLatestBlock, GetDbInstance } from '../dbUtils';
import * as schema from '../../schema';
import { sql, desc, gt, and, inArray, not, eq } from "drizzle-orm";
import { FormatDates } from '../dateUtils';

export const IndexHandlerOpts: RouteShorthandOptions = {
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
                        type: 'number'
                    },
                    topProviders: {
                        type: 'array',
                    },
                    allSpecs: {
                        type: 'array',
                    },
                    qosData: {
                        type: 'array'
                    },
                    data: {
                        type: 'array'
                    }
                }
            }
        }
    }
}

export async function IndexHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance()
    //
    const { latestHeight, latestDatetime } = await GetLatestBlock()
    // logger.info(`Latest block: ${latestHeight}, ${latestDatetime}`)

    //
    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    let res = await GetDbInstance().select({
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`
    }).from(schema.aggHourlyrelayPayments)
    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
        rewardSum = res[0].rewardSum
    }
    // logger.info(`Total payments: cuSum=${cuSum}, relaySum=${relaySum}, rewardSum=${rewardSum}`)

    //
    // Get total provider stake
    let stakeSum = 0
    let res2 = await GetDbInstance().select({
        stakeSum: sql<number>`sum(${schema.providerStakes.stake})`,
    }).from(schema.providerStakes)
    if (res2.length != 0) {
        stakeSum = res2[0].stakeSum
    }

    //
    // Get "top" providers
    let res4 = await GetDbInstance().select({
        address: schema.aggHourlyrelayPayments.provider,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        groupBy(schema.aggHourlyrelayPayments.provider).
        orderBy(desc(sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`))
    let providersAddrs: string[] = []
    res4.map((provider) => {
        providersAddrs.push(provider.address!)
    })

    if (providersAddrs.length == 0) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    //
    // provider details
    let res44 = await GetDbInstance().select().from(schema.providers).where(inArray(schema.providers.address, providersAddrs))
    let providerStakesRes = await GetDbInstance().select({
        provider: schema.providerStakes.provider,
        totalActiveServices: sql<number>`sum(case when ${schema.providerStakes.status} = ${schema.LavaProviderStakeStatus.Active} then 1 else 0 end)`,
        totalServices: sql<number>`count(${schema.providerStakes.specId})`,
        totalStake: sql<number>`sum(${schema.providerStakes.stake})`,
    }).from(schema.providerStakes)
        .where(not(eq(schema.providerStakes.status, schema.LavaProviderStakeStatus.Frozen)))
        .groupBy(schema.providerStakes.provider);

    type ProviderDetails = {
        addr: string,
        moniker: string,
        rewardSum: number,
        totalServices: string,
        totalStake: number,
    };
    let providersDetails: ProviderDetails[] = []
    res4.forEach((provider) => {
        let moniker = ''
        let totalServices = '0'
        let totalStake = 0;
        let tmp1 = res44.find((el) => el.address == provider.address)
        if (tmp1) {
            moniker = tmp1.moniker!
        }
        let tmp2 = providerStakesRes.find((el) => el.provider == provider.address)
        if (tmp2) {
            totalServices = `${tmp2.totalActiveServices} / ${tmp2.totalServices}`
            totalStake = tmp2.totalStake
        }
        providersDetails.push({
            addr: provider.address!,
            moniker: moniker,
            rewardSum: provider.rewardSum,
            totalServices: totalServices,
            totalStake: totalStake,
        })
    })

    // logger.info(`Provider details: ${JSON.stringify(providersDetails)}`)

    //
    // Get top chains
    let topSpecs = await GetDbInstance().select({
        chainId: schema.aggHourlyrelayPayments.specId,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
    }).from(schema.aggHourlyrelayPayments).
        groupBy(sql`${schema.aggHourlyrelayPayments.specId}`).
        where(gt(sql<Date>`DATE(${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`)).
        orderBy(desc(sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`))
    let getChains: string[] = []
    topSpecs.map((chain) => {
        if (getChains.length < 8) {
            getChains.push(chain.chainId!)
        }
    })

    if (getChains.length === 0 || topSpecs.length === 0) {
        console.log('IndexHandler getChains:', getChains, 'topSpecs:', topSpecs);
    }

    //
    // Get graph with 1 day resolution
    let mainChartData = {}
    if (getChains.length != 0) {
        mainChartData = await GetDbInstance().select({
            date: sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
            chainId: schema.aggHourlyrelayPayments.specId,
            cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
            relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
            rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
        }).from(schema.aggHourlyrelayPayments).
            where(
                and(
                    gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                    inArray(schema.aggHourlyrelayPayments.specId, getChains)
                )
            ).
            groupBy(sql`${schema.aggHourlyrelayPayments.specId}`, sql`mydate`).
            orderBy(sql`mydate`)
    }

    //
    // QoS graph
    let qosDataRaw = await GetDbInstance().select({
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        qosSyncAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`)).
        groupBy(sql`mydate`).
        orderBy(sql`mydate`)

    //
    return {
        height: latestHeight,
        datetime: latestDatetime,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        topProviders: providersDetails,
        allSpecs: topSpecs,
        qosData: FormatDates(qosDataRaw),
        data: FormatDates(mainChartData),
    }
}