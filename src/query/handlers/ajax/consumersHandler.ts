// src/query/handlers/ConsumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance } from '../../queryDb';
import { SpecAndConsumerCache } from '../../classes/QuerySpecAndConsumerCache';

export const ConsumersPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    consumers: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function ConsumersPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    const res = SpecAndConsumerCache.GetAllConsumers();

    return {
        consumers: res,
    }
}