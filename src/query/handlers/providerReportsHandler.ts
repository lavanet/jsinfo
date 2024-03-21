
// src/query/handlers/providerReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';

export const ProviderReportsHandlerOpts: RouteShorthandOptions = {
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
                                provider_reported: {
                                    type: 'object',
                                    properties: {
                                        provider: {
                                            type: 'string'
                                        },
                                        blockId: {
                                            type: 'number'
                                        },
                                        cu: {
                                            type: 'number'
                                        },
                                        disconnections: {
                                            type: 'number'
                                        },
                                        epoch: {
                                            type: 'number'
                                        },
                                        errors: {
                                            type: 'number'
                                        },
                                        project: {
                                            type: 'string'
                                        },
                                        datetime: {
                                            type: 'string',
                                            format: 'date-time'
                                        },
                                        totalComplaintEpoch: {
                                            type: 'number'
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

export async function ProviderReportsHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    //
    const res = await GetReadDbInstance().select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("blocks.datetime,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
    if (pagination.sortKey === null) pagination.sortKey = "blocks.datetime";

    // Validate sortKey
    const validKeys = ["provider_reported.blockId", "blocks.datetime", "provider_reported.cu", "provider_reported.disconnections", "provider_reported.errors", "provider_reported.project"];
    if (!validKeys.includes(pagination.sortKey)) {
        reply.code(400).send({ error: 'Invalid sort key' });
        return;
    }

    // Get reports
    let reportsRes = await GetReadDbInstance().select().from(schema.providerReported).
        leftJoin(schema.blocks, eq(schema.providerReported.blockId, schema.blocks.height)).
        where(eq(schema.providerReported.provider, addr)).
        orderBy(
            pagination.sortKey.startsWith('blocks.')
                ? (pagination.direction === 'ascending' ?
                    asc(schema.blocks[pagination.sortKey.split('.')[1]]) :
                    desc(schema.blocks[pagination.sortKey.split('.')[1]]))
                : (pagination.direction === 'ascending' ?
                    asc(schema.providerReported[pagination.sortKey.split('.')[1]]) :
                    desc(schema.providerReported[pagination.sortKey.split('.')[1]]))
        ).
        offset((pagination.page - 1) * pagination.count).limit(pagination.count)

    console.log("reportsRes: ", reportsRes)

    return { data: reportsRes }
}

export async function ProviderReportsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
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

    let reportsRes = await GetReadDbInstance().select({ count: sql`count(*)`.mapWith(Number) }).from(schema.providerReported).
        leftJoin(schema.blocks, eq(schema.providerReported.blockId, schema.blocks.height)).
        where(eq(schema.providerReported.provider, addr))

    return { itemCount: reportsRes[0].count }
}