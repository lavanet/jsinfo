// src/query/handlers/specsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, QueryGetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';

export const SpecsHandlerOpts: RouteShorthandOptions = {
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

export async function SpecsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

    const res = await QueryGetReadDbInstance().select().from(schema.specs)

    return {
        specs: res,
    }
}
