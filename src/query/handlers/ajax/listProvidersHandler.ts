// src/query/handlers/ListProvidersRawHandler.ts

// curl http://localhost:8081/listProviders | jq
// curl http://localhost:8081/listProviders | jq | grep ">"

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProvidersData, ListProvidersResource } from '@jsinfo/redis/resources/ajax/ListProvidersResource';

export const ListProvidersRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            height: { type: 'number' },
                            datetime: { type: 'number' },
                            providers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        provider: { type: 'string' },
                                        specs: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    chain: { type: 'string' },
                                                    spec: { type: 'string' },
                                                    moniker: { type: 'string' },
                                                    stakestatus: { type: 'string' },
                                                    stake: { type: 'string' },
                                                    addons: { type: 'string' },
                                                    extensions: { type: 'string' },
                                                    delegateCommission: { type: 'string' },
                                                    delegateLimit: { type: 'string' },
                                                    delegateTotal: { type: 'string' },
                                                },
                                                required: ['spec', 'moniker']
                                            }
                                        }
                                    },
                                    required: ['provider', 'specs']
                                }
                            }
                        },
                        required: ['height', 'datetime', 'providers']
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string'
                    }
                }
            }
        }
    }
};

export async function ListProvidersRawHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<{ data: ProvidersData }> {
    const resource = new ListProvidersResource();
    const data = await resource.fetch();
    if (!data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers data' });
        return reply;
    }
    return { data };
}