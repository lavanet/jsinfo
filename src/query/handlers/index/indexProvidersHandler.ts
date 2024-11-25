// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ParsePaginationFromRequest } from '@jsinfo/query/utils/queryPagination';
import { GetDataLength } from '@jsinfo/utils/fmt';
import { IndexProvidersResource, IndexProvidersResourceResponse } from '@jsinfo/redis/resources/index/IndexProvidersResource';

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
                                rewardSum: { type: ['number', 'null', 'string'] },
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

export async function IndexProvidersPaginatedHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexProvidersResourceResponse> {
    const resource = new IndexProvidersResource();
    const result = await resource.fetch({
        type: 'paginated',
        pagination: ParsePaginationFromRequest(request) ?? undefined
    });
    if (!result || !result.data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers data' });
        return reply;
    }
    return result;
}

export const IndexProvidersItemCountPaginatiedHandlerOpts: RouteShorthandOptions = {
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
    const result = await resource.fetch({ type: 'count' });
    if (!result || (typeof result.count !== 'number' && typeof result.count !== 'string')) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers count' });
        return reply;
    }
    const count = typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
    return { itemCount: count };
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
    const result = await resource.fetch({ type: 'all' });
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