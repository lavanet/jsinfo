// src/query/handlers/indexTopChainsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexTopChainsResource, IndexTopChainsData } from '../../../redis/resources/index/IndexTopChainsResource';

export const IndexTopChainsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    allSpecs: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                chainId: { type: 'string' },
                                relaySum: { type: 'number' },
                                cuSum: { type: 'number' },
                                relaySum30Days: { type: 'number' },
                                cuSum30Days: { type: 'number' }
                            }
                        }
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
}

export async function IndexTopChainsHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexTopChainsData> {
    const resource = new IndexTopChainsResource();
    const result = await resource.fetch();
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch top chains data' });
        return reply;
    }
    return result;
}
