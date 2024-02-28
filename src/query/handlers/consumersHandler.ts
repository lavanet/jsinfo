// src/query/handlers/consumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckDbInstance, GetDbInstance } from '../dbUtils';
import * as schema from '../../schema';

export const ConsumersHandlerOpts: RouteShorthandOptions = {
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

export async function ConsumersHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance()

    const res = await GetDbInstance().select().from(schema.consumers)

    return {
        consumers: res,
    }
}