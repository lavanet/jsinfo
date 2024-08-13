// src/query/handlers/consumerspageHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt } from "drizzle-orm";
import { logger, MinBigInt } from '../../../utils/utils';

export const ConsumersPageHandlerOpts: RouteShorthandOptions = {
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

export async function ConsumersPageHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    let res = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggAllTimeRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggAllTimeRelayPayments.relaySum})`,
        rewardSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggAllTimeRelayPayments.rewardSum})`
    }).from(JsinfoConsumerAgrSchema.aggAllTimeRelayPayments)
    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
        rewardSum = res[0].rewardSum
    }

    // Get total provider stake
    let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).orderBy(desc(JsinfoSchema.providerStakes.stake));
    let stakeSum = 0n;
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake! + MinBigInt(stake.delegateTotal, stake.delegateLimit);
    });

    // Get top chains
    let topSpecs = await QueryGetJsinfoReadDbInstance().select({
        chainId: JsinfoConsumerAgrSchema.aggDailyRelayPayments.specId,
        relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggDailyRelayPayments.relaySum}) as relaySum`,
    }).from(JsinfoConsumerAgrSchema.aggDailyRelayPayments).
        groupBy(sql`${JsinfoConsumerAgrSchema.aggDailyRelayPayments.specId}`).
        where(gt(JsinfoConsumerAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`)).
        orderBy(sql`relaySum DESC`)
    let getChains: string[] = []
    topSpecs.map((chain) => {
        if (getChains.length < 8) {
            getChains.push(chain.chainId!)
        }
    })

    if (getChains.length === 0 || topSpecs.length === 0) {
        topSpecs = await QueryGetJsinfoReadDbInstance().select({
            chainId: JsinfoSchema.specs.id,
            relaySum: sql<number>`0`,
        }).from(JsinfoSchema.specs)
    }

    return {
        height: latestHeight,
        datetime: latestDatetime,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum.toString(),
        allSpecs: topSpecs,
    }
}
