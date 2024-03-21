
// src/query/handlers/providerEventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';

export const ProviderEventsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                events: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number' },
                                        eventType: { type: 'number' },
                                        t1: { type: ['string', 'null'] },
                                        t2: { type: ['string', 'null'] },
                                        t3: { type: ['string', 'null'] },
                                        b1: { type: 'number' },
                                        b2: { type: 'number' },
                                        b3: { type: ['number', 'null'] },
                                        i1: { type: ['number', 'null'] },
                                        i2: { type: ['number', 'null'] },
                                        i3: { type: ['number', 'null'] },
                                        r1: { type: ['number', 'null'] },
                                        r2: { type: ['number', 'null'] },
                                        r3: { type: ['number', 'null'] },
                                        provider: { type: 'string' },
                                        consumer: { type: ['string', 'null'] },
                                        blockId: { type: 'number' },
                                        tx: { type: ['string', 'null'] },
                                    },
                                    required: ['id', 'eventType', 'b1', 'b2', 'provider', 'blockId']
                                },
                                blocks: {
                                    type: 'object',
                                    properties: {
                                        height: { type: 'number' },
                                        datetime: { type: 'string' },
                                    },
                                    required: ['height', 'datetime']
                                }
                            },
                            required: ['events', 'blocks']
                        }
                    }
                }
            }
        }
    }
}

export async function ProviderEventsHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await GetReadDbInstance().select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("events.id,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
    if (pagination.sortKey === null) pagination.sortKey = "events.id";

    // Validate sortKey
    const validKeys = ["events.eventType", "blocks.height", "blocks.datetime", "events.b1", "events.b2", "events.b3", "events.i1", "events.i2", "events.i3", "events.t1", "events.t2", "events.t3"];
    if (!validKeys.includes(pagination.sortKey)) {
        reply.code(400).send({ error: 'Invalid sort key' });
        return;
    }

    // Get events
    const eventsRes = await GetReadDbInstance().select().from(schema.events).
        leftJoin(schema.blocks, eq(schema.events.blockId, schema.blocks.height)).
        where(eq(schema.events.provider, addr)).
        orderBy(
            pagination.sortKey.startsWith('blocks.')
                ? (pagination.direction === 'ascending' ?
                    asc(schema.blocks[pagination.sortKey.split('.')[1]]) :
                    desc(schema.blocks[pagination.sortKey.split('.')[1]]))
                : (pagination.direction === 'ascending' ?
                    asc(schema.events[pagination.sortKey.split('.')[1]]) :
                    desc(schema.events[pagination.sortKey.split('.')[1]]))
        ).
        offset((pagination.page - 1) * pagination.count).limit(pagination.count)

    return { data: eventsRes }
}

export async function ProviderEventsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await GetReadDbInstance().select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const eventsCount = await GetReadDbInstance().select({ count: sql`count(*)`.mapWith(Number) }).from(schema.events).
        leftJoin(schema.blocks, eq(schema.events.blockId, schema.blocks.height)).
        where(eq(schema.events.provider, addr));

    return { itemCount: eventsCount[0].count }
}