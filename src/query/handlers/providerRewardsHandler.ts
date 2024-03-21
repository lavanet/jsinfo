
// src/query/handlers/providerRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';

export const ProviderRewardsHandlerOpts: RouteShorthandOptions = {
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
                                relay_payments: {
                                    type: 'object',
                                    properties: {
                                        id: {
                                            type: 'number'
                                        },
                                        relays: {
                                            type: 'number'
                                        },
                                        cu: {
                                            type: 'number'
                                        },
                                        pay: {
                                            type: ['number', 'null']
                                        },
                                        datetime: {
                                            type: 'string',
                                            format: 'date-time'
                                        },
                                        qosSync: {
                                            type: 'number'
                                        },
                                        qosAvailability: {
                                            type: 'number'
                                        },
                                        qosLatency: {
                                            type: 'number'
                                        },
                                        qosSyncExc: {
                                            type: 'number'
                                        },
                                        qosAvailabilityExc: {
                                            type: 'number'
                                        },
                                        qosLatencyExc: {
                                            type: 'number'
                                        },
                                        provider: {
                                            type: 'string'
                                        },
                                        specId: {
                                            type: 'string'
                                        },
                                        blockId: {
                                            type: 'number'
                                        },
                                        consumer: {
                                            type: 'string'
                                        },
                                        tx: {
                                            type: 'string'
                                        }
                                    }
                                },
                                blocks: {
                                    type: 'object',
                                    properties: {
                                        height: {
                                            type: 'number'
                                        },
                                        datetime: {
                                            type: 'string',
                                            format: 'date-time'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

export async function ProviderRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
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

    let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("relay_payments.id,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
    if (pagination.sortKey === null) pagination.sortKey = "relay_payments.id";

    // Validate sortKey
    const validKeys = ["relay_payments.specId", "relay_payments.blockId", "blocks.datetime", "relay_payments.consumer", "relay_payments.relays", "relay_payments.cu", "relay_payments.qosSync", "relay_payments.qosSyncExc"];
    if (!validKeys.includes(pagination.sortKey)) {
        reply.code(400).send({ error: 'Invalid sort key' });
        return;
    }

    // Get payments
    const paymentsRes = await GetReadDbInstance().select().from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        where(eq(schema.relayPayments.provider, addr)).
        orderBy(
            pagination.sortKey.startsWith('blocks.')
                ? (pagination.direction === 'ascending' ?
                    asc(schema.blocks[pagination.sortKey.split('.')[1]]) :
                    desc(schema.blocks[pagination.sortKey.split('.')[1]]))
                : (pagination.direction === 'ascending' ?
                    asc(schema.relayPayments[pagination.sortKey.split('.')[1]]) :
                    desc(schema.relayPayments[pagination.sortKey.split('.')[1]]))
        ).
        offset((pagination.page - 1) * pagination.count).limit(pagination.count)

    return { data: paymentsRes }
}

export async function ProviderRewardsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
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

    const paymentsRes = await GetReadDbInstance().select({ count: sql`count(*)`.mapWith(Number) }).from(schema.relayPayments).
        leftJoin(schema.blocks, eq(schema.relayPayments.blockId, schema.blocks.height)).
        where(eq(schema.relayPayments.provider, addr))

    return { itemCount: paymentsRes[0].count }
}