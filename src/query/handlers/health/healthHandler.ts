// src/query/handlers/HealthRawHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';

export const HealthRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    health: {
                        type: 'string'
                    }
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

export async function HealthRawHandler(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ health: "ok" });
}