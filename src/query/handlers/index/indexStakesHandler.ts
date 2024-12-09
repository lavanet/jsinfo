// src/query/handlers/indexStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexStakesResource, IndexStakesData } from '../../../redis/resources/index/IndexStakesResource';

export const IndexStakesHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    stakeSum: {
                        type: 'string'
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

export async function IndexStakesHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexStakesData> {
    const resource = new IndexStakesResource();
    const result = await resource.fetch();
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch stakes data' });
        return reply;
    }
    return result;
}
