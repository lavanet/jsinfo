// src/query/handlers/indexHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt } from "drizzle-orm";
import { logger, MinBigInt } from '../../../utils/utils';
import { RedisCache } from '../../classes/RedisCache';
import { JSINFO_QUERY_NETWORK } from '../../queryConsts';

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
                    cuSum30Days: {
                        type: 'number'
                    },
                    relaySum30Days: {
                        type: 'number'
                    },
                    stakeSum: {
                        type: 'number'
                    },
                    allSpecs: {
                        type: 'array',
                    },
                    cacheHitRate: {
                        type: 'number'
                    }
                }
            }
        }
    }
}

export async function IndexHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()
    logger.info(`IndexHandler:: Latest block: ${latestHeight}, ${latestDatetime}`)

    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let res = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
    }).from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
    }

    let cuSum30Days = 0
    let relaySum30Days = 0
    let res30Days = await QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
    }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
        where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`))

    if (res30Days.length != 0) {
        cuSum30Days = res30Days[0].cuSum
        relaySum30Days = res30Days[0].relaySum
    }

    // Get total provider stake
    let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).orderBy(desc(JsinfoSchema.providerStakes.stake));
    let stakeSum = 0n;
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake! + MinBigInt(stake.delegateTotal, stake.delegateLimit);
    });

    // Get top chains
    let topSpecs = await QueryGetJsinfoReadDbInstance().select({
        chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) as relaySum`,
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}) as cuSum`,
    }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
        groupBy(sql`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`).
        where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`)).
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
            cuSum: sql<number>`0`,
        }).from(JsinfoSchema.specs)
    }

    const cacheHitRateData = await RedisCache.getDictNoKeyPrefix("jsinfo-healthp-cachedmetrics") || {};

    let sum = 0;
    let count = 0;

    if (JSINFO_QUERY_NETWORK === 'mainnet') {
        for (const [key, value] of Object.entries(cacheHitRateData)) {
            if (key.toUpperCase() === 'LAVA' && value !== 0) {
                sum += value;
                count++;
            }
        }
    } else {
        for (const [key, value] of Object.entries(cacheHitRateData)) {
            if (key.toUpperCase() !== 'LAVA' && value !== 0) {
                sum += value;
                count++;
            }
        }
    }

    const cacheHitRateAverage = count > 0 ? sum / count : 0;

    return {
        height: latestHeight,
        datetime: latestDatetime,
        cuSum: cuSum,
        relaySum: relaySum,
        cuSum30Days: cuSum30Days,
        relaySum30Days: relaySum30Days,
        stakeSum: stakeSum.toString(),
        allSpecs: topSpecs,
        cacheHitRate: cacheHitRateAverage.toFixed(2),
    }
}
