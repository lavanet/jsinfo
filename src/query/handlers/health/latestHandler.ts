// src/query/handlers/LatestRawHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, GetLatestBlock } from '../../queryDb';

export const LatestRawHandlerOpts: RouteShorthandOptions = {
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

export async function LatestRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()
    return {
        height: latestHeight,
        datetime: latestDatetime,
    }
}