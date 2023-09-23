
import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, desc, eq } from "drizzle-orm";
import * as schema from './schema';

const sqlite = new Database('dev.db')
const db: BetterSQLite3Database = drizzle(sqlite)

const server: FastifyInstance = Fastify({
    logger: true,
})

const latestOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: {
                        type: 'number'
                    },
                    cuSum: {
                        type: 'number'
                    },
                    relaySum: {
                        type: 'number'
                    }
                }
            }
        }
    }
}

server.get('/latest', latestOpts, async (request, reply) => {
    //
    const latestDbBlocks = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
    let latestHeight = 0
    if (latestDbBlocks.length != 0) {
        latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
    }

    //
    let cuSum = 0
    let relaySum = 0
    let res = await db.select({
        cuSum: sql<number>`sum(${schema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${schema.relayPayments.relays})`
    }).from(schema.relayPayments)
    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
    }

    //
    //await db.select().from(schema.providerStakes).orderBy(desc(schema.providerStakes.id))
    return { height: latestHeight, cuSum: cuSum, relaySum: relaySum }
})

const providerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
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
                    events: {
                        type: 'array',
                    }
                }
            }
        }
    }
}

server.get('/provider/:addr', providerOpts, async (request, reply) => {
    const { addr } = request.params as { addr: string }
    if (addr.length != 44) {
        return {} // TODO: errors
    }
    if (!addr.startsWith('lava@')) {
        return {} // TODO: errors
    }

    //
    const res = await db.select().from(schema.providers).where(eq(schema.providers.address, addr))
    if (res.length != 1) {
        return {} // TODO: errors
    }
    const provider = res[0]

    //
    let cuSum = 0
    let relaySum = 0
    let rewardSum = 0
    const res2 = await db.select({
        cuSum: sql<number>`sum(${schema.relayPayments.cu})`,
        relaySum: sql<number>`sum(${schema.relayPayments.relays})`,
        rewardSum: sql<number>`sum(${schema.relayPayments.pay})`
    }).from(schema.relayPayments).where(eq(schema.relayPayments.provider, addr))
    if (res2.length == 1) {
        cuSum = res2[0].cuSum
        relaySum = res2[0].relaySum
        rewardSum = res2[0].rewardSum
    }

    //
    const res3 = await db.select().from(schema.events).where(eq(schema.events.provider, addr))
    return {
        addr: provider.address,
        moniker: provider.moniker,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        events: res3,
    }
})

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
                    }
                }
            }
        }
    }
}

server.get('/consumer/:addr', consumerOpts, async (request, reply) => {
    const { addr } = request.params as { addr: string }
    if (addr.length != 44) {
        return {} // TODO: errors
    }
    if (!addr.startsWith('lava@')) {
        return {} // TODO: errors
    }

    //
    const res = await db.select().from(schema.consumers).where(eq(schema.consumers.address, addr))
    if (res.length != 1) {
        return {} // TODO: errors
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
    const res3 = await db.select().from(schema.conflictResponses).where(eq(schema.conflictResponses.consumer, addr))
    const res4 = await db.select().from(schema.subscriptionBuys).where(eq(schema.subscriptionBuys.consumer, addr))
    //subscription_buys
    return {
        addr: addr,
        cuSum: cuSum,
        relaySum: relaySum,
        rewardSum: rewardSum,
        conflicts: res3,
        subsBuy: res4,
    }
})

export const queryserver = async (): Promise<void> => {
    try {
        await server.listen({ port: 3000 })

        const address = server.server.address()
        const port = typeof address === 'string' ? address : address?.port

    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

queryserver()