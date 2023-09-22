
import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, desc } from "drizzle-orm";
import * as schema from './schema';

const sqlite = new Database('dev.db')
const db: BetterSQLite3Database = drizzle(sqlite)

const server: FastifyInstance = Fastify({
    logger: true,
})

const opts: RouteShorthandOptions = {
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

server.get('/latest', opts, async (request, reply) => {
    const latestDbBlocks = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
    let latestHeight = 0
    if (latestDbBlocks.length != 0) {
        latestHeight = latestDbBlocks[0].height == null ? 0: latestDbBlocks[0].height 
    }

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
    return { height: latestHeight, cuSum: cuSum, relaySum: relaySum }
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
