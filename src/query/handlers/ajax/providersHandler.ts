
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource'

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
    const providers = await ProviderMonikerService.GetAllProviders();
    return {
        providers: providers,
    }
}
