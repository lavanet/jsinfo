// src/query/handlers/eventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, GetLatestBlock, QueryGetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { desc, eq } from "drizzle-orm";

export const EventsHandlerOpts: RouteShorthandOptions = {
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

export async function EventsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    const res3 = await QueryGetReadDbInstance().select().from(schema.events).
        leftJoin(schema.blocks, eq(schema.events.blockId, schema.blocks.height)).
        leftJoin(schema.providers, eq(schema.events.provider, schema.providers.address)).
        orderBy(desc(schema.events.id)).offset(0).limit(250)
    const res6 = await QueryGetReadDbInstance().select().from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        leftJoin(schema.providers, eq(schema.relayPayments.provider, schema.providers.address)).
        orderBy(desc(schema.relayPayments.id)).offset(0).limit(250)
    let res7 = await QueryGetReadDbInstance().select().from(schema.providerReported).
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

}