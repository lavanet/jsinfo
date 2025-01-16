
// src/query/handlers/providersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource'
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';

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

export const ActiveProvidersPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    providers: { type: 'array' },
                }
            }
        }
    }
}

export async function ActiveProvidersPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    const providers = await ActiveProvidersService.fetch();
    return {
        providers: providers,
    }
}