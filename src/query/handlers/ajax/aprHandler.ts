// src/query/handlers/ajax/aprHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AprResource } from '@jsinfo/redis/resources/ajax/AprResource';

export const APRRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
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

export async function APRRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new AprResource();
    const data = await resource.fetchAndPickDb();
    if (!data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch APR data' });
        return reply;
    }
    return JSON.stringify(data);
}
