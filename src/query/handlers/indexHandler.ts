// src/query/handlers/indexHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, gt, and, inArray } from "drizzle-orm";
import { FormatDates } from '../utils/queryDateUtils';
import { logger } from '../../utils';

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
    await QueryCheckJsinfoReadDbInstance()
    //
    const { latestHeight, latestDatetime } = await GetLatestBlock()
    logger.info(`IndexHandler:: Latest block: ${latestHeight}, ${latestDatetime}`)

    //
    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    let res = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`
    }).from(JsinfoSchema.aggHourlyrelayPayments)
    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
        rewardSum = res[0].rewardSum
    }
    // logger.info(`Total payments: cuSum=${cuSum}, relaySum=${relaySum}, rewardSum=${rewardSum}`)

    //
    // Get total provider stake
    let stakeSum = 0
    let stakeSumQueryRes = await QueryGetJsinfoReadDbInstance().select({
        stakeSum: sql<number>`sum(${JsinfoSchema.providerStakes.stake})`,
    }).from(JsinfoSchema.providerStakes)
    if (stakeSumQueryRes.length != 0) {
        stakeSum = stakeSumQueryRes[0].stakeSum
    }

    //
    // Get "top" providers
    let res4 = await QueryGetJsinfoReadDbInstance().select({
        address: JsinfoSchema.aggHourlyrelayPayments.provider,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        groupBy(JsinfoSchema.aggHourlyrelayPayments.provider).
        orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`))
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
    let topSpecs = await QueryGetJsinfoReadDbInstance().select({
        chainId: JsinfoSchema.aggHourlyrelayPayments.specId,
        relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        groupBy(sql`${JsinfoSchema.aggHourlyrelayPayments.specId}`).
        where(gt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`)).
        orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`))
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
        mainChartData = await QueryGetJsinfoReadDbInstance().select({
            date: sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
            chainId: JsinfoSchema.aggHourlyrelayPayments.specId,
            cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
            relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
            rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
        }).from(JsinfoSchema.aggHourlyrelayPayments).
            where(
                and(
                    gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`),
                    inArray(JsinfoSchema.aggHourlyrelayPayments.specId, getChains)
                )
            ).
            groupBy(sql`${JsinfoSchema.aggHourlyrelayPayments.specId}`, sql`mydate`).
            orderBy(sql`mydate`)
    }

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
        where(gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`)).
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