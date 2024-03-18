
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';

export const ProvidersHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    providers: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function ProvidersHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const res = await GetReadDbInstance().select().from(schema.providers)
    return {
        providers: res,
    }
}
