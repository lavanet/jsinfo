// src/query/handlers/indexLatestBlockHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock } from '../../queryDb';

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
    await QueryCheckJsinfoReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    return {
        height: latestHeight,
        datetime: latestDatetime
    }
}
