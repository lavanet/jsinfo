import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AllProviderAPRResource } from '@jsinfo/redis/resources/ajax/AllProviderAprResource';

export const AllProviderAPRRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string',
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
        return reply.status(400).send({ error: 'Failed to fetch All Provider APR data' });
    }

    const processedData = data.map(item => ({
        ...item,
        tokens: typeof item.tokens === 'string' ? JSON.parse(item.tokens) : item.tokens
    }));

    return JSON.stringify(processedData);
}