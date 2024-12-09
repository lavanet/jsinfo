// src/query/handlers/index/index30DayCuHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { Index30DayCuResource, Index30DayCuData } from '../../../redis/resources/index/Index30DayCuResource';

export const Index30DayCuHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum30Days: {
                        type: 'number'
                    },
                    relaySum30Days: {
                        type: 'number'
                    },
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

export async function Index30DayCuHandler(request: FastifyRequest, reply: FastifyReply): Promise<Index30DayCuData> {
    const resource = new Index30DayCuResource();
    const result = await resource.fetch();
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch 30 day CU data' });
        return reply;
    }
    return result;
}
