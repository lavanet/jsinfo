// src/query/handlers/ajax/aprHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AprFullService } from '@jsinfo/redis/resources/APR/AprFullResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

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
    const data = await AprFullService.fetch();
    if (!data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch APR data' });
        return reply;
    }
    reply.header('Content-Type', 'application/json');
    return JSONStringify(data.percentile);
}
