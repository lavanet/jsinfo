// src/query/handlers/indexHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt } from "drizzle-orm";
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
        cuSum: sql<number>`sum(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.rewardSum})`
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments)
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
    // Get top chains
    let topSpecs = await QueryGetJsinfoReadDbInstance().select({
        chainId: JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId,
        relaySum: sql<number>`sum(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`,
    }).from(JsinfoProviderAgrSchema.aggHourlyRelayPayments).
        groupBy(sql`${JsinfoProviderAgrSchema.aggHourlyRelayPayments.specId}`).
        where(gt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`)).
        orderBy(desc(sql<number>`sum(${JsinfoProviderAgrSchema.aggHourlyRelayPayments.relaySum})`))
    let getChains: string[] = []
    topSpecs.map((chain) => {
        if (getChains.length < 8) {
            getChains.push(chain.chainId!)
        }
    })

    if (getChains.length === 0 || topSpecs.length === 0) {
        console.log('IndexHandler empty data for topSpecs:: getChains:', getChains, 'topSpecs:', topSpecs);
    }

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
