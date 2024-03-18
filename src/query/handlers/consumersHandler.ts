// src/query/handlers/consumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
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
    await CheckReadDbInstance()

    const res = await GetReadDbInstance().select().from(schema.consumers)

    return {
        consumers: res,
    }
}