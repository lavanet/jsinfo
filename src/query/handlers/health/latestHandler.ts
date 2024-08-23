// src/query/handlers/LatestRawHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock } from '../../queryDb';

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
    await QueryCheckJsinfoReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()
    return {
        height: latestHeight,
        datetime: latestDatetime,
    }
}