
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, QueryGetReadDbInstance } from '../queryDb';
import { isNotNull } from "drizzle-orm";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';

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
    await QueryCheckReadDbInstance()

    const res = await QueryGetReadDbInstance().select().from(JsinfoSchema.providers).where(isNotNull(JsinfoSchema.providers.address))

    return {
        providers: res,
    }
}
