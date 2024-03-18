// src/query/handlers/specsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
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
    await CheckReadDbInstance()

    const res = await GetReadDbInstance().select().from(schema.specs)

    return {
        specs: res,
    }
}
