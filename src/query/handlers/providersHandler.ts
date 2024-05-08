
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import { isNotNull } from "drizzle-orm";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';

export const ProvidersCachedHandlerOpts: RouteShorthandOptions = {
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

export async function ProvidersCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(isNotNull(JsinfoSchema.providers.address))

    return {
        providers: res,
    }
}
