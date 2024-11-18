// src/query/handlers/index/indexLatestBlockHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexLatestBlockResource, IndexLatestBlockData } from '../../../redis/resources/index/IndexLatestBlockResource';

export const IndexLatestBlockHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: { type: 'number' },
                    datetime: { type: 'number' }
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

export async function IndexLatestBlockHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexLatestBlockData> {
    const resource = new IndexLatestBlockResource();
    const result = await resource.fetchAndPickDb();
    if (!result || result == null) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch latest block data' });
        return reply;
    }
    return result;
}
