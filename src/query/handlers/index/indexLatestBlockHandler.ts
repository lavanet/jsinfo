// src/query/handlers/indexLatestBlockHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, GetLatestBlock } from '../../queryDb';

export const IndexLatestBlockHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: {
                        type: 'number'
                    },
                    datetime: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function IndexLatestBlockHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    return {
        height: latestHeight,
        datetime: latestDatetime
    }
}
