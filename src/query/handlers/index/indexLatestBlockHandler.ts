// src/query/handlers/index/indexLatestBlockHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexLatestBlockResource } from '../../../redis/resources/index/IndexLatestBlockResource';

export const IndexLatestBlockHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: { type: 'number' },
                    datetime: { type: 'number' },
                    serverTime: { type: 'number' }
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

export interface IndexLatestBlockResponseData {
    height: number;
    datetime: number;
    serverTime: number;
}

export async function IndexLatestBlockHandler(request: FastifyRequest, reply: FastifyReply): Promise<IndexLatestBlockResponseData> {
    const resource = new IndexLatestBlockResource();
    const result = await resource.fetch();
    if (!result || result == null) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch latest block data' });
        return reply;
    }
    return {
        ...result,
        serverTime: Date.now()
    };
}
