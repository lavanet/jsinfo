
import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, desc } from "drizzle-orm";
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
                    pong: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

server.get('/ping', opts, async (request, reply) => {
    const latestDbBlocks = await db.select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
    let latestDbBlock: any
    if (latestDbBlocks.length != 0) {
        latestDbBlock = latestDbBlocks[0]
    }

    console.log(request.query)
    return { pong: latestDbBlock.height }
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
