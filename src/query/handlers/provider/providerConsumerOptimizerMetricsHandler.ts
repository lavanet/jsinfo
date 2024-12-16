// src/query/handlers/provider/providerConsumerOptimizerMetricsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ConsumerOptimizerMetricsResource } from '@jsinfo/redis/resources/provider/consumerOptimizerMetrics';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const ProviderConsumerOptimizerMetricsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export async function ProviderConsumerOptimizerMetricsHandler(request: FastifyRequest, reply: FastifyReply) {
    const provider = await GetAndValidateProviderAddressFromRequest("ProviderConsumerOptimizerMetricsHandler", request, reply);
    if (provider === '') {
        return reply;
    }

    const resource = new ConsumerOptimizerMetricsResource();
    const data = await resource.fetch({
        provider,
        consumer: (request.query as any).consumer,
        chain_id: (request.query as any).chain_id,
        from: (request.query as any).from ? new Date((request.query as any).from) : undefined,
        to: (request.query as any).to ? new Date((request.query as any).to) : undefined
    });

    reply.header('Content-Type', 'application/json');
    return reply.send(JSONStringify(data));
}