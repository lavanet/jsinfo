// src/query/handlers/specsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance } from '../../queryDb';
import { SpecAndConsumerCache } from '../../classes/QuerySpecAndConsumerCache';

export const SpecsPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    specs: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function SpecsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    const res = await SpecAndConsumerCache.GetAllSpecs();

    return {
        specs: res,
    }
}
