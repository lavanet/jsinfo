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
    let topProvidersRes = await QueryGetJsinfoReadDbInstance().select({
        address: JsinfoSchema.aggHourlyrelayPayments.provider,
        rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
    }).from(JsinfoSchema.aggHourlyrelayPayments).
        groupBy(JsinfoSchema.aggHourlyrelayPayments.provider).
        orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`))
    let providersAddrs: string[] = []
    topProvidersRes.map((provider) => {
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
        where(gt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`)).
        orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`))

    return {
        height: latestHeight,
        datetime: latestDatetime,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        allSpecs: topSpecs,
    }
}
