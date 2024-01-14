// jsinfo/src/query.ts

// TODOs:
// 1. Errors
// 2. Pagination
require('dotenv').config();

import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import { sql, desc, eq, gt, and, inArray } from "drizzle-orm";
import * as schema from './schema';
import { GetDb } from './utils';
import RequestCache from './queryCache';
import { FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';

const requestCache = new RequestCache();
let db = GetDb()

async function checkDb() {
    try {
        await db.select().from(schema.blocks).limit(1)
    } catch (e) {
        console.log('checkDb exception, resetting connection', e)
        db = GetDb()
    }
}

async function getLatestBlock() {
    //
    const latestDbBlocks = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
    let latestHeight = 0
    let latestDatetime = 0
    if (latestDbBlocks.length != 0) {
        latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
        latestDatetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime()
    }
    return { latestHeight, latestDatetime }
}

const server: FastifyInstance = Fastify({
    logger: true,
})

server.register(fastifyCors, { origin: "*" });

const latestOpts: RouteShorthandOptions = {
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
                }
            }
        }
    }
}


server.get('/latest', latestOpts, async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { latestHeight, latestDatetime } = await getLatestBlock()
    return {
        height: latestHeight,
        datetime: latestDatetime,
    }
})


const indexOpts: RouteShorthandOptions = {
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

server.get('/index', indexOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    //
    const { latestHeight, latestDatetime } = await getLatestBlock()

    //
    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    let res = await db.select({
        cuSum: sql<number>`sum(${schema.relayPaymentsAggView.cuSum})`,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`
    }).from(schema.relayPaymentsAggView)
    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
        rewardSum = res[0].rewardSum
    }

    //
    // Get total provider stake
    let stakeSum = 0
    let res2 = await db.select({
        stakeSum: sql<number>`sum(${schema.providerStakes.stake})`,
    }).from(schema.providerStakes)
    if (res2.length != 0) {
        stakeSum = res2[0].stakeSum
    }

    //
    // Get "top" providers
    let res4 = await db.select({
        address: schema.relayPaymentsAggView.provider,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`,
    }).from(schema.relayPaymentsAggView).
        groupBy(schema.relayPaymentsAggView.provider).
        orderBy(desc(sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`))
    let providersAddrs: string[] = []
    res4.map((provider) => {
        providersAddrs.push(provider.address!)
    })
    //
    // provider details
    let res44 = await db.select().from(schema.providers).where(inArray(schema.providers.address, providersAddrs))
    let res444 = await db.select({
        provider: schema.providerStakes.provider,
        nStakes: sql<number>`count(${schema.providerStakes.specId})`,
        totalStake: sql<number>`sum(${schema.providerStakes.stake})`
    }).from(schema.providerStakes).groupBy(schema.providerStakes.provider)
    type ProviderDetails = {
        addr: string,
        moniker: string,
        rewardSum: number,
        nStakes: number,
        totalStake: number,
    };
    let providersDetails: ProviderDetails[] = []
    res4.forEach((provider) => {
        let moniker = ''
        let nStakes = 0
        let totalStake = 0;
        let tmp1 = res44.find((el) => el.address == provider.address)
        if (tmp1) {
            moniker = tmp1.moniker!
        }
        let tmp2 = res444.find((el) => el.provider == provider.address)
        if (tmp2) {
            nStakes = tmp2.nStakes
            totalStake = tmp2.totalStake
        }
        providersDetails.push({
            addr: provider.address!,
            moniker: moniker,
            rewardSum: provider.rewardSum,
            nStakes: nStakes,
            totalStake: totalStake,
        })
    })

    //
    // Get top chains
    let res8 = await db.select({
        chainId: schema.relayPaymentsAggView.chainId,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
    }).from(schema.relayPaymentsAggView).
        groupBy(sql`${schema.relayPaymentsAggView.chainId}`).
        where(gt(sql<Date>`DATE(${schema.relayPaymentsAggView.date})`, sql<Date>`now() - interval '30 day'`)).
        orderBy(desc(sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`))
    let getChains: string[] = []
    res8.map((chain) => {
        if (getChains.length < 8) {
            getChains.push(chain.chainId!)
        }
    })

    //
    // Get graph with 1 day resolution
    let res3 = await db.select({
        date: sql<string>`to_char(${schema.relayPaymentsAggView.date}, 'MON dd')`,
        chainId: schema.relayPaymentsAggView.chainId,
        cuSum: sql<number>`sum(${schema.relayPaymentsAggView.cuSum})`,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`,
    }).from(schema.relayPaymentsAggView).
        where(
            and(
                gt(schema.relayPaymentsAggView.date, sql<Date>`now() - interval '30 day'`),
                inArray(schema.relayPaymentsAggView.chainId, getChains)
            )
        ).
        groupBy(sql`${schema.relayPaymentsAggView.chainId}`, schema.relayPaymentsAggView.date).
        orderBy(schema.relayPaymentsAggView.date)

    //
    // QoS graph
    let res6 = await db.select({
        date: sql<string>`to_char(${schema.relayPaymentsAggView.date}, 'MON dd')`,
        qosSyncAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosSyncAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosAvailabilityAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosLatencyAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosSyncExcAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosAvailabilityAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.relayPaymentsAggView.qosLatencyExcAv}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
    }).from(schema.relayPaymentsAggView).
        where(gt(schema.relayPaymentsAggView.date, sql<Date>`now() - interval '30 day'`)).
        groupBy(schema.relayPaymentsAggView.date).
        orderBy(schema.relayPaymentsAggView.date)

    return {
        height: latestHeight,
        datetime: latestDatetime,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        topProviders: providersDetails,
        allSpecs: res8,
        qosData: res6,
        data: res3,
    }
}))

const providerOpts: RouteShorthandOptions = {
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
                }
            }
        }
    }
}

server.get('/provider/:addr', providerOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        return {error: 'bad address'}
    }

    //
    const res = await db.select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        return {error: 'address does not exist'}
    }

    const provider = res[0]
    const { latestHeight, latestDatetime } = await getLatestBlock()

    //
    // Sums
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await db.select({
        cuSum: sql<number>`sum(${schema.relayPaymentsAggView.cuSum})`,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`,
    }).from(schema.relayPaymentsAggView).
        where(eq(schema.relayPaymentsAggView.provider, addr)).
        groupBy(schema.relayPaymentsAggView.provider)
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }
    const res6 = await db.select().from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        where(eq(schema.relayPayments.provider, addr)).
        orderBy(desc(schema.relayPayments.id)).offset(0).limit(50)
    //
    const res3 = await db.select().from(schema.events).
        leftJoin(schema.blocks, eq(schema.events.blockId, schema.blocks.height)).
        where(eq(schema.events.provider, addr)).
        orderBy(desc(schema.events.id)).offset(0).limit(50)

    //
    // Get stakes
    let res5 = await db.select().from(schema.providerStakes).
        where(eq(schema.providerStakes.provider, addr)).orderBy(desc(schema.providerStakes.stake))
    let stakeSum = 0
    res5.forEach((stake) => {
        stakeSum += stake.stake!
    })

    //
    // Get reports
    let res7 = await db.select().from(schema.providerReported).
        leftJoin(schema.blocks, eq(schema.providerReported.blockId, schema.blocks.height)).
        where(eq(schema.providerReported.provider, addr)).
        orderBy(desc(schema.providerReported.blockId)).limit(50)

    //
    // Get graph with 1 day resolution
    let data1 = await db.select({
        date: sql<string>`to_char(${schema.relayPaymentsAggView.date}, 'MON dd')`,
        chainId: schema.relayPaymentsAggView.chainId,
        cuSum: sql<number>`sum(${schema.relayPaymentsAggView.cuSum})`,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`,
    }).from(schema.relayPaymentsAggView).
        where(
            and(
                gt(schema.relayPaymentsAggView.date, sql<Date>`now() - interval '30 day'`),
                eq(schema.relayPaymentsAggView.provider, addr)
            )
        ).
        groupBy(sql`${schema.relayPaymentsAggView.chainId}`, schema.relayPaymentsAggView.date).
        orderBy(schema.relayPaymentsAggView.date)

    //
    // QoS graph
    let data2 = await db.select({
        date: sql<string>`to_char(${schema.relayPaymentsAggView.date}, 'MON dd')`,
        qosSyncAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosSyncAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosAvailabilityAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosLatencyAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosSyncExcAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosAvailabilityAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.relayPaymentsAggView.qosLatencyExcAv}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
    }).from(schema.relayPaymentsAggView).
        where(
            and(
                gt(schema.relayPaymentsAggView.date, sql<Date>`now() - interval '30 day'`),
                eq(schema.relayPaymentsAggView.provider, addr)
            )
        ).
        groupBy(schema.relayPaymentsAggView.date).
        orderBy(schema.relayPaymentsAggView.date)


    return {
        height: latestHeight,
        datetime: latestDatetime,
        addr: provider.address,
        moniker: provider.moniker,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        stakeSum: stakeSum,
        events: res3,
        stakes: res5,
        payments: res6,
        reports: res7,
        qosData: data2,
        data: data1,
    }
}))

const providersOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    providers: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

server.get('/providers', providersOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const res = await db.select().from(schema.providers)
    return {
        providers: res,
    }
}))

const specssOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    specs: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

server.get('/specs', specssOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const res = await db.select().from(schema.specs)
    
    return {
        specs: res,
    }
}))

const consumersOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    consumers: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

server.get('/consumers', consumersOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const res = await db.select().from(schema.consumers)
    
    return {
        consumers: res,
    }
}))


const consumerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    addr: {
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
                    conflicts: {
                        type: 'array'
                    },
                    subsBuy: {
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

server.get('/consumer/:addr', consumerOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        return {error: 'invalid address'}
    }

    //
    const res = await db.select().from(schema.consumers).where(eq(schema.consumers.address, addr)).limit(1)
    if (res.length != 1) {
        return {error: 'address does not exist'}
    }

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await db.select({
        cuSum: sql<number>`sum(${schema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${schema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${schema.relayPayments.pay})`
    }).from(schema.relayPayments).where(eq(schema.relayPayments.consumer, addr))
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    // Get graph with 1 day resolution
    let res5 = await db.select({
        date: sql<Date>`DATE(${schema.blocks.datetime})`,
        cuSum: sql<number>`sum(${schema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${schema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${schema.relayPayments.pay})`
    }).from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        groupBy(sql<Date>`DATE(${schema.blocks.datetime})`).
        where(and(
            gt(sql<Date>`DATE(${schema.blocks.datetime})`, sql<Date>`now() - interval '30 day'`),
            eq(schema.relayPayments.consumer, addr)
        )).
        orderBy(sql<Date>`DATE(${schema.blocks.datetime})`)

    //
    const res3 = await db.select().from(schema.conflictResponses).where(eq(schema.conflictResponses.consumer, addr)).
        orderBy(desc(schema.conflictResponses.id)).offset(0).limit(50)
    const res4 = await db.select().from(schema.subscriptionBuys).where(eq(schema.subscriptionBuys.consumer, addr)).
        orderBy(desc(schema.subscriptionBuys.blockId)).offset(0).limit(50)
    return {
        addr: addr,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        conflicts: res3,
        subsBuy: res4,
        data: res5,
    }
}))

const SpecOpts: RouteShorthandOptions = {
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
                    specId: {
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
                    stakes: {
                        type: 'array',
                    },
                    qosData: {
                        type: 'array'
                    },
                    data: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

server.get('/spec/:specId', SpecOpts, requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { specId } = request.params as { specId: string }
    if (specId.length <= 0) {
        return {error: 'invalid specId'}
    }
    const upSpecId = specId.toUpperCase()

    //
    const res = await db.select().from(schema.specs).where(eq(schema.specs.id, upSpecId)).limit(1)
    if (res.length != 1) {
        return {error: 'specId does not exist'}
    }
    const { latestHeight, latestDatetime } = await getLatestBlock()

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await db.select({
        cuSum: sql<number>`sum(${schema.relayPaymentsAggView.cuSum})`,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`
    }).from(schema.relayPaymentsAggView).where(eq(schema.relayPaymentsAggView.chainId, upSpecId))
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    // Get stakes
    let res5 = await db.select().from(schema.providerStakes).
        leftJoin(schema.providers, eq(schema.providerStakes.provider, schema.providers.address)).
        where(eq(schema.providerStakes.specId, upSpecId)).
        orderBy(desc(schema.providerStakes.stake))

    //
    // Get graph with 1 day resolution
    let res3 = await db.select({
        date: sql<string>`to_char(${schema.relayPaymentsAggView.date}, 'MON dd')`,
        cuSum: sql<number>`sum(${schema.relayPaymentsAggView.cuSum})`,
        relaySum: sql<number>`sum(${schema.relayPaymentsAggView.relaySum})`,
        rewardSum: sql<number>`sum(${schema.relayPaymentsAggView.rewardSum})`
    }).from(schema.relayPaymentsAggView).
        groupBy(schema.relayPaymentsAggView.date).
        where(
            and(
                gt(schema.relayPaymentsAggView.date, sql<Date>`now() - interval '30 day'`),
                eq(schema.relayPaymentsAggView.chainId, upSpecId)
            )
        ).
        orderBy(schema.relayPaymentsAggView.date)

    //
    // QoS graph
    let res6 = await db.select({
        date: sql<string>`to_char(${schema.relayPaymentsAggView.date}, 'MON dd')`,
        qosSyncAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosSyncAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosAvailabilityAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosLatencyAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosSyncExcAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.relayPaymentsAggView.qosAvailabilityAvg}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.relayPaymentsAggView.qosLatencyExcAv}*${schema.relayPaymentsAggView.relaySum})/sum(${schema.relayPaymentsAggView.relaySum})`,
    }).from(schema.relayPaymentsAggView).
        where(
            and(
                gt(schema.relayPaymentsAggView.date, sql<Date>`now() - interval '30 day'`),
                eq(schema.relayPaymentsAggView.chainId, upSpecId)
            )
        ).groupBy(schema.relayPaymentsAggView.date).
        orderBy(schema.relayPaymentsAggView.date)

    return {
        height: latestHeight,
        datetime: latestDatetime,
        specId: res[0].id,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        qosData: res6,
        stakes: res5,
        data: res3,
    }
}))

const eventsOpts: RouteShorthandOptions = {
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
                    events: {
                        type: 'array'
                    },
                    payments: {
                        type: 'array',
                    },
                    reports: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

server.get('/events', eventsOpts, await requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {

    const { latestHeight, latestDatetime } = await getLatestBlock()

    //
    const res3 = await db.select().from(schema.events).
        leftJoin(schema.blocks, eq(schema.events.blockId, schema.blocks.height)).
        leftJoin(schema.providers, eq(schema.events.provider, schema.providers.address)).
        orderBy(desc(schema.events.id)).offset(0).limit(250)
    const res6 = await db.select().from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        leftJoin(schema.providers, eq(schema.relayPayments.provider, schema.providers.address)).
        orderBy(desc(schema.relayPayments.id)).offset(0).limit(250)
    let res7 = await db.select().from(schema.providerReported).
        leftJoin(schema.blocks, eq(schema.providerReported.blockId, schema.blocks.height)).
        leftJoin(schema.providers, eq(schema.providerReported.provider, schema.providers.address)).
        orderBy(desc(schema.providerReported.blockId)).limit(250)
    
    // TODO: return & display dbConflictResponses
    return {
        height: latestHeight,
        datetime: latestDatetime,
        events: res3,
        payments: res6,
        reports: res7,
    }

}))

export const queryserver = async (): Promise<void> => {
    const port = parseInt(process.env['QUERY_PORT']!)
    const host = process.env['QUERY_HOST']!

    try {
        try {
            const { latestHeight, latestDatetime } = await getLatestBlock()
            server.log.info(`block ${latestHeight} block time ${latestDatetime}`)
        } catch (err) {
            server.log.error('failed to connect get block from db')
            server.log.error(String(err))
            process.exit(1)
        }

        server.log.info(`listening on ${port} ${host}`)
        await server.listen({ port: port, host: host })
    } catch (err) {
        server.log.error(String(err))
        process.exit(1)
    }
}

try {
    queryserver();
} catch (error) {
    if (error instanceof Error) {
        console.error('An error occurred while running the queryserver:', error.message);
        console.error('Stack trace:', error.stack);
    } else {
        console.error('An unknown error occurred while running the queryserver:', error);
    }
}
