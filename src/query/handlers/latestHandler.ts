// src/query/handlers/latestHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetLatestBlock } from '../queryDb';

export const LatestHandlerOpts: RouteShorthandOptions = {
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

export async function LatestHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()
    return {
        height: latestHeight,
        datetime: latestDatetime,
    }
}