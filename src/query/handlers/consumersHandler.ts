// src/query/handlers/consumersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, QueryGetReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';

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
    await QueryCheckReadDbInstance()

    const res = await QueryGetReadDbInstance().select().from(JsinfoSchema.consumers)

    return {
        consumers: res,
    }
}