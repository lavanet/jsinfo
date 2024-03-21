
// src/query/handlers/providerStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';

export const ProviderStakesHandlerOpts: RouteShorthandOptions = {
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
                                stake: {
                                    type: 'number'
                                },
                                appliedHeight: {
                                    type: 'number'
                                },
                                geolocation: {
                                    type: 'number'
                                },
                                addons: {
                                    type: 'string'
                                },
                                extensions: {
                                    type: 'string'
                                },
                                status: {
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
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

export async function ProviderStakesHandler(request: FastifyRequest, reply: FastifyReply) {
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

    let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("specId,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
    if (pagination.sortKey === null) pagination.sortKey = "specId";

    // Validate sortKey
    const validKeys = ["specId", "status", "geolocation", "addons", "extensions", "stake"];
    if (!validKeys.includes(pagination.sortKey)) {
        reply.code(400).send({ error: 'Invalid sort key' });
        return;
    }

    // Get stakes
    let stakesRes = await GetReadDbInstance().select().from(schema.providerStakes).
        where(eq(schema.providerStakes.provider, addr)).
        orderBy(
            pagination.direction === 'ascending' ?
                asc(schema.providerStakes[pagination.sortKey]) :
                desc(schema.providerStakes[pagination.sortKey])
        ).
        offset((pagination.page - 1) * pagination.count).limit(pagination.count)

    return { data: stakesRes }
}

export async function ProviderStakesItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
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

    // Get stakes
    let stakesRes = await GetReadDbInstance().select({ count: sql`count(*)`.mapWith(Number) }).from(schema.providerStakes).
        where(eq(schema.providerStakes.provider, addr))

    return { itemCount: stakesRes[0].count }
}