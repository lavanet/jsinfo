import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { ConsumerOptimizerMetricsFullService } from '@jsinfo/redis/resources/provider/consumerOptimizerMetricsFull';
import { JSINFO_QUERY_CONSUMER_OPTIMIZER_METRICS_FULL_KEY } from '@jsinfo/query/queryConsts';
import { logger } from '@jsinfo/utils/logger';

export const ProviderConsumerOptimizerMetricsFullHandlerOpts: RouteShorthandOptions = {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                provider: { type: 'string' },
                key: { type: 'string' },
                from: { type: 'string' },
                to: { type: 'string' }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    filters: {
                        type: 'object',
                        properties: {
                            provider: { type: 'string' },
                            from: { type: 'string' },
                            to: { type: 'string' }
                        }
                    },
                    metrics: { type: 'array' },
                    error: { type: 'string' }
                }
            }
        }
    }
};

export async function ProviderConsumerOptimizerMetricsFullHandler(request: FastifyRequest, reply: FastifyReply) {
    const key = (request.query as any).key;
    if (key !== JSINFO_QUERY_CONSUMER_OPTIMIZER_METRICS_FULL_KEY) {
        logger.warn('Invalid key for full metrics access');
        return {
            filters: {},
            metrics: [],
            error: 'Access denied'
        };
    }

    const addr = await GetAndValidateProviderAddressFromRequest("ProviderConsumerOptimizerMetricsFull", request, reply);
    if (addr === '') {
        return null;
    }

    const from = (request.query as any).from ? new Date((request.query as any).from) : undefined;
    const to = (request.query as any).to ? new Date((request.query as any).to) : undefined;

    return await ConsumerOptimizerMetricsFullService.fetch({
        provider: addr,
        from,
        to
    });
} 