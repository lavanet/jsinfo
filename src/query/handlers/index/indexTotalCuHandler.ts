// src/query/handlers/index/indexTotalCuHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexTotalCuResource, IndexTotalCuData } from '../../../redis/resources/index/IndexTotalCuResource';

export const IndexTotalCuHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum: {
                        type: 'number'
                    },
                    relaySum: {
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

export async function IndexTotalCuHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexTotalCuData> {
    const resource = new IndexTotalCuResource();
    const result = await resource.fetchAndPickDb();
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch total CU data' });
        return reply;
    }
    return result;
}
