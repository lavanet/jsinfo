// src/query/handlers/indexHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, GetLatestBlock, QueryGetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { sql, desc, gt, and, inArray } from "drizzle-orm";
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
    await QueryCheckReadDbInstance()
    //
    const { latestHeight, latestDatetime } = await GetLatestBlock()
    // logger.info(`Latest block: ${latestHeight}, ${latestDatetime}`)

    //
    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    let res = await QueryGetReadDbInstance().select({
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
    let res2 = await QueryGetReadDbInstance().select({
        stakeSum: sql<number>`sum(${schema.providerStakes.stake})`,
    }).from(schema.providerStakes)
    if (res2.length != 0) {
        stakeSum = res2[0].stakeSum
    }

    //
    // Get "top" providers
    let res4 = await QueryGetReadDbInstance().select({
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
        reply.code(400).send({ error: 'Providers does not exist' });
        return;
    }

    //
    // Get top chains
    let topSpecs = await QueryGetReadDbInstance().select({
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
        console.log('IndexHandler empty data for topSpecs:: getChains:', getChains, 'topSpecs:', topSpecs);
    }

    //
    // Get graph with 1 day resolution
    let mainChartData = {}
    if (getChains.length != 0) {
        mainChartData = await QueryGetReadDbInstance().select({
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
    let qosDataRaw = await QueryGetReadDbInstance().select({
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

    return {
        height: latestHeight,
        datetime: latestDatetime,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        allSpecs: topSpecs,
        qosData: FormatDates(qosDataRaw),
        data: addAllChains(adjustRelayLossForMarchWeekendDowntime(FormatDates(mainChartData))),
    }
}

function addAllChains(mainChartData) {
    const dateSums = {};
    mainChartData.forEach(data => {
        if (!dateSums[data.date]) {
            dateSums[data.date] = { date: data.date, chainId: "All Chains", cuSum: 0, relaySum: 0, rewardSum: null };
        }
        dateSums[data.date].cuSum += Number(data.cuSum);
        dateSums[data.date].relaySum += Number(data.relaySum);
    });
    const newChartData = Object.values(dateSums);
    return mainChartData.concat(newChartData);
}

function adjustRelayLossForMarchWeekendDowntime(mainChartData) {
    mainChartData.forEach(data => {
        if (data.date === "Mar 2") {
            data.relaySum = Number(data.relaySum) * 1.7;
        } else if (data.date === "Mar 3") {
            data.relaySum = Number(data.relaySum) * 1.6;
        }
    });
    return mainChartData
}