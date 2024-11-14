// src/query/handlers/ConsumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { SpecAndConsumerService } from '@jsinfo/redis/resources/global/SpecAndConsumerResource';

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
    const res = await SpecAndConsumerService.GetAllConsumers();
    return {
        consumers: res,
    }
}