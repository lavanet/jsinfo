// jsinfo/src/query.ts

// TODOs:
// 1. Errors
// 2. Pagination
require('dotenv').config();

import Fastify, { FastifyBaseLogger, FastifyInstance, RouteShorthandOptions } from 'fastify'
import pino from 'pino';

import { sql, desc, eq, gt, and, inArray } from "drizzle-orm";
import * as schema from './schema';
import { GetDb, logger } from './utils';
import RequestCache from './queryCache';
import { FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';

import brotli from 'brotli';

const requestCache: RequestCache = new RequestCache();
let db: PostgresJsDatabase;

function formatDates(dataArray) {
    return dataArray.map(item => {
        const date = new Date(item.date);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}`;
        return {
            ...item,
            date: formattedDate
        };
    });
}

async function checkDb() {
    try {
        await db.select().from(schema.blocks).limit(1)
    } catch (e) {
        logger.info('checkDb exception, resetting connection', e)
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

const FastifyLogger: FastifyBaseLogger = pino({
    // level: 'warn',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
        }
    }
});

const server: FastifyInstance = Fastify({ logger: FastifyLogger });

server.register(fastifyCors, { origin: "*" });

const isOnSendLogsEnabled = false;

server.addHook('onSend', async (request, reply, payload) => {
    try {
        if (isOnSendLogsEnabled) logger.info('onSendHook: started');
        if (request.headers['accept-encoding']?.includes('br')) {
            if (isOnSendLogsEnabled) logger.info('onSendHook: Brotli encoding is accepted');
            const compressedPayload = await brotli.compress(Buffer.from(payload as Buffer));
            if (isOnSendLogsEnabled) logger.info('onSendHook: Compression completed');
            if (compressedPayload) {
                if (isOnSendLogsEnabled) logger.info('onSendHook: Compression was successful');
                reply.header('Content-Encoding', 'br');
                if (isOnSendLogsEnabled) logger.info('onSendHook:', compressedPayload);
                return Buffer.from(compressedPayload, 'utf8');
            } else {
                if (isOnSendLogsEnabled) logger.info('onSendHook: Compression failed');
            }
            if (isOnSendLogsEnabled) logger.info('onSendHook: Returning original payload');
        }
    } catch (error) {
        if (isOnSendLogsEnabled) logger.info('onSendHook: An error occurred:', error);
        if (isOnSendLogsEnabled) logger.info('onSendHook: Returning original payload');
    }
    return payload;
});

function addErrorResponse(consumerOpts: RouteShorthandOptions): RouteShorthandOptions {
    const schema = consumerOpts.schema || {};
    const response = schema.response || {};

    return {
        ...consumerOpts,
        schema: {
            ...schema,
            response: {
                ...response,
                400: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    };
}

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

server.get('/index', addErrorResponse(indexOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()
    
    //
    const { latestHeight, latestDatetime } = await getLatestBlock()
    // logger.info(`Latest block: ${latestHeight}, ${latestDatetime}`)

    //
    // Get total payments and more
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    let res = await db.select({
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
    let res2 = await db.select({
        stakeSum: sql<number>`sum(${schema.providerStakes.stake})`,
    }).from(schema.providerStakes)
    if (res2.length != 0) {
        stakeSum = res2[0].stakeSum
    }

    //
    // Get "top" providers
    let res4 = await db.select({
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

    // logger.info(`Provider details: ${JSON.stringify(providersDetails)}`)

    //
    // Get top chains
    let res8 = await db.select({
        chainId: schema.aggHourlyrelayPayments.specId,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
    }).from(schema.aggHourlyrelayPayments).
        groupBy(sql`${schema.aggHourlyrelayPayments.specId}`).
        where(gt(sql<Date>`DATE(${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`)).
        orderBy(desc(sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`))
    let getChains: string[] = []
    res8.map((chain) => {
        if (getChains.length < 8) {
            getChains.push(chain.chainId!)
        }
    })

    
    //
    // Get graph with 1 day resolution
    let res3 = await db.select({
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

    //
    // QoS graph
    let res6 = await db.select({
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
        allSpecs: res8,
        qosData: formatDates(res6),
        data: formatDates(res3),
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

server.get('/provider/:addr', addErrorResponse(providerOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    //
    const res = await db.select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const provider = res[0]
    const { latestHeight, latestDatetime } = await getLatestBlock()

    //
    // Sums
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await db.select({
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(eq(schema.aggHourlyrelayPayments.provider, addr)).
        groupBy(schema.aggHourlyrelayPayments.provider)
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
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        chainId: schema.aggHourlyrelayPayments.specId,
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.provider, addr)
            )
        ).
        groupBy(sql`${schema.aggHourlyrelayPayments.specId}`, sql`mydate`).
        orderBy(sql`mydate`)

    //
    // QoS graph
    let data2 = await db.select({
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        qosSyncAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.provider, addr)
            )
        ).
        groupBy(sql`mydate`).
        orderBy(sql`mydate`)

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
        qosData: formatDates(data2),
        data: formatDates(data1),
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

server.get('/providers', addErrorResponse(providersOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
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

server.get('/specs', addErrorResponse(specssOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
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

server.get('/consumers', addErrorResponse(consumersOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
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

server.get('/consumer/:addr', addErrorResponse(consumerOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider name' });
        return;
    }

    //
    const res = await db.select().from(schema.consumers).where(eq(schema.consumers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
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

server.get('/spec/:specId', addErrorResponse(SpecOpts), requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {
    await checkDb()

    const { specId } = request.params as { specId: string }
    if (specId.length <= 0) {
        reply.code(400).send({ error: 'invalid specId' });
        return;
    }
    const upSpecId = specId.toUpperCase()

    //
    const res = await db.select().from(schema.specs).where(eq(schema.specs.id, upSpecId)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'specId does not exist' });
        return;
    }
    const { latestHeight, latestDatetime } = await getLatestBlock()

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await db.select({
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`
    }).from(schema.aggHourlyrelayPayments).where(eq(schema.aggHourlyrelayPayments.specId, upSpecId))
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
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        cuSum: sql<number>`sum(${schema.aggHourlyrelayPayments.cuSum})`,
        relaySum: sql<number>`sum(${schema.aggHourlyrelayPayments.relaySum})`,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`
    }).from(schema.aggHourlyrelayPayments).
        groupBy(sql`mydate`).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.specId, upSpecId)
            )
        ).
        orderBy(sql`mydate`)

    //
    // QoS graph
    let res6 = await db.select({
        date: sql`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour}) as mydate`,
        qosSyncAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosSyncExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosSyncExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosAvailabilityExcAvg: sql<number>`sum(${schema.aggHourlyrelayPayments.qosAvailabilityAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
        qosLatencyExcAv: sql<number>`sum(${schema.aggHourlyrelayPayments.qosLatencyExcAvg}*${schema.aggHourlyrelayPayments.relaySum})/sum(${schema.aggHourlyrelayPayments.relaySum})`,
    }).from(schema.aggHourlyrelayPayments).
        where(
            and(
                gt(sql<string>`DATE_TRUNC('day', ${schema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`),
                eq(schema.aggHourlyrelayPayments.specId, upSpecId)
            )
        ).groupBy(sql`mydate`).
        orderBy(sql`mydate`)

    return {
        height: latestHeight,
        datetime: latestDatetime,
        specId: res[0].id,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        qosData: formatDates(res6),
        stakes: res5,
        data: formatDates(res3),
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

server.get('/events', addErrorResponse(eventsOpts), await requestCache.handleRequestWithCache(async (request: FastifyRequest, reply: FastifyReply) => {

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
    console.log('Starting queryserver - connecting to db')
    db = await GetDb();

    const portString = process.env['JSINFO_QUERY_PORT']!;
    if (!portString) {
        throw new Error('JSINFO_QUERY_PORT environment variable is not set or is an empty string');
    }
    const port = parseInt(portString);
    
    const host = process.env['JSINFO_QUERY_HOST']!;
    if (!host) {
        throw new Error('JSINFO_QUERY_HOST environment variable is not set or is an empty string');
    }

    try {
        try {
            const { latestHeight, latestDatetime } = await getLatestBlock()
            logger.info(`block ${latestHeight} block time ${latestDatetime}`)
        } catch (err) {
            logger.error('failed to connect get block from db')
            logger.error(String(err))
            logger.error('Sleeping one second before exit')
            await new Promise(resolve => setTimeout(resolve, 1000));
            process.exit(1)
        }

        logger.info(`listening on ${port} ${host}`)
        await server.listen({ port: port, host: host })
    } catch (err) {
        logger.error(String(err))
        logger.error('Sleeping one second before exit')
        await new Promise(resolve => setTimeout(resolve, 1000));
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
