// src/query/handlers/eventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
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
    await QueryCheckJsinfoReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    //
    const eventsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.events).
        leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.events.blockId, JsinfoSchema.blocks.height)).
        leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.events.provider, JsinfoSchema.providers.address)).
        orderBy(desc(JsinfoSchema.events.id)).offset(0).limit(250)
    const payemntsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.relayPayments).
        leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height)).
        leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.relayPayments.provider, JsinfoSchema.providers.address)).
        orderBy(desc(JsinfoSchema.relayPayments.id)).offset(0).limit(250)
    let reportsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerReported).
        leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.providerReported.blockId, JsinfoSchema.blocks.height)).
        leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerReported.provider, JsinfoSchema.providers.address)).
        orderBy(desc(JsinfoSchema.providerReported.blockId)).limit(250)

    return {
        height: latestHeight,
        datetime: latestDatetime,
        events: eventsRes,
        payments: payemntsRes,
        reports: reportsRes,
    }

}