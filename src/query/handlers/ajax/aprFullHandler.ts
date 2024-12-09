// src/query/handlers/ajax/aprFullInfoHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AprFullResource } from '@jsinfo/redis/resources/ajax/AprFullResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const APRFullHandlerOpts: RouteShorthandOptions = {
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

export async function APRFullHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new AprFullResource();
    const data = await resource.fetch();
    if (!data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch APR full info data' });
        return reply;
    }
    reply.header('Content-Type', 'application/json');
    return JSONStringify(data);
}
