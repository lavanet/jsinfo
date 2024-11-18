// src/query/handlers/indexProvidersActiveHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ParsePaginationFromRequest } from '@jsinfo/query/utils/queryPagination';
import { GetDataLength } from '@jsinfo/utils/fmt';
import { IndexProvidersActiveResource, IndexProvidersActiveResourceResponse } from '@jsinfo/redis/resources/index/IndexProvidersActiveResource';

export const IndexProvidersActivePaginatedHandlerOpts: RouteShorthandOptions = {
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

export async function IndexProvidersActivePaginatedHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexProvidersActiveResourceResponse> {
    const resource = new IndexProvidersActiveResource();
    const result = await resource.fetchAndPickDb({
        type: 'paginated',
        pagination: ParsePaginationFromRequest(request) ?? undefined
    });
    if (!result || !result.data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch active providers data' });
        return reply;
    }
    return result;
}

export const IndexProvidersActiveItemCountPaginatiedHandlerOpts: RouteShorthandOptions = {
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

export async function IndexProvidersActiveItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ itemCount: number }> {
    const resource = new IndexProvidersActiveResource();
    const result = await resource.fetchAndPickDb({ type: 'count' });
    if (!result || (typeof result.count !== 'number' && typeof result.count !== 'string')) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch active providers count' });
        return reply;
    }
    const count = typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
    return { itemCount: count };
}

export const IndexProvidersActiveCSVRawHandlerOpts: RouteShorthandOptions = {
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

export async function IndexProvidersActiveCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new IndexProvidersActiveResource();
    const result = await resource.fetchAndPickDb({ type: 'all' });
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch active providers data' });
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
    reply.header('Content-Disposition', `attachment; filename="LavaActiveProviders.csv"`);
    return csv;
}

