// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ParsePaginationFromRequest } from '@jsinfo/query/utils/queryPagination';
import { GetDataLength } from '@jsinfo/utils/fmt';
import { IndexProvidersResource } from '@jsinfo/redis/resources/index/IndexProvidersResource';

type IndexProvidersResponse = {
    provider: string,
    moniker: string,
    monikerfull: string,
    rewardSum: number,
    totalServices: string,
    totalStake: string,
};

export const IndexProvidersPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                provider: { type: 'string' },
                                moniker: { type: 'string' },
                                monikerfull: { type: 'string' },
                                rewardSum: { type: ['number', 'null'] },
                                totalServices: { type: 'string' },
                                totalStake: { type: ['string', 'null'] }
                            }
                        }
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export async function IndexProvidersPaginatedHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexProvidersResponse[]> {
    const resource = new IndexProvidersResource();
    const result = await resource.fetchAndPickDb({
        type: 'paginated',
        pagination: ParsePaginationFromRequest(request) ?? undefined
    });
    if (!result || !result.data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers data' });
        return reply;
    }
    return result.data;
}

export const IndexProvidersItemCountHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    itemCount: { type: 'number' }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export async function IndexProvidersItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ itemCount: number }> {
    const resource = new IndexProvidersResource();
    const result = await resource.fetchAndPickDb({ type: 'count' });
    if (!result || typeof result.count !== 'number') {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers count' });
        return reply;
    }
    return { itemCount: result.count };
}

export const IndexProvidersCSVRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export async function IndexProvidersCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new IndexProvidersResource();
    const result = await resource.fetchAndPickDb({ type: 'all' });
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers data' });
        return reply;
    }

    if (!result.data || GetDataLength(result.data) === 0) {
        reply.status(400);
        reply.send({ error: 'Data is unavailable now' });
        return reply;
    }

    const csv = await resource.ConvertRecordsToCsv(result.data);
    if (!csv) {
        reply.status(400);
        reply.send({ error: 'Data is not available in CSV format' });
        return reply;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="LavaTopProviders.csv"`);
    return csv;
}