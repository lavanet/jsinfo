// src/query/handlers/autoCompleteLinksV2Handler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AutoCompleteResource, AutoCompleteData } from '@jsinfo/redis/resources/ajax/AutoCompleteResource';

export const AutoCompleteLinksV2PaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                    },
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

export async function AutoCompleteLinksV2PaginatedHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<AutoCompleteData> {
    const autoCompleteResource = new AutoCompleteResource();
    const result = await autoCompleteResource.fetchAndPickDb();
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch autocomplete data' });
        return reply;
    }
    return result;
}