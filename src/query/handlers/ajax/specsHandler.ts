// src/query/handlers/specsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';

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
    await QueryCheckJsinfoReadDbInstance()

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.specs)

    return {
        specs: res,
    }
}
