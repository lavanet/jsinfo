
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import { isNotNull } from "drizzle-orm";
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';

export const ProvidersPaginatedHandlerOpts: RouteShorthandOptions = {
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

export async function ProvidersPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const providers = await QueryGetJsinfoReadDbInstance()
        .select({
            address: JsinfoSchema.providerSpecMoniker.provider
        })
        .from(JsinfoSchema.providerSpecMoniker)
        .where(isNotNull(JsinfoSchema.providerSpecMoniker.provider))
        .groupBy(JsinfoSchema.providerSpecMoniker.provider);

    return {
        providers: providers,
    }
}
