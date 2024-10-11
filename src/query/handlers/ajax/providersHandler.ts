
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import { isNotNull } from "drizzle-orm";
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { MonikerCache } from '../../classes/QueryProviderMonikerCache';

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

    const providers = MonikerCache.GetAllProviders();

    return {
        providers: providers,
    }
}
