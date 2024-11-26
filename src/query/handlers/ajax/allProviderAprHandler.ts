import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AllProviderAPRResource } from '@jsinfo/redis/resources/ajax/AllProviderAprResource';

export const AllProviderAPRRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        address: { type: 'string' },
                        moniker: { type: 'string' },
                        apr: { type: 'string' },
                        commission: { type: 'any' },
                        '30_days_cu_served': { type: 'any' },
                        tokens: { type: 'object' }
                    },
                    required: ['address', 'moniker', 'apr']
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

export async function AllProviderAPRRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new AllProviderAPRResource();
    const data = await resource.fetch();
    if (!data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch All Provider APR data' });
        return reply;
    }
    return JSON.stringify(data);
}