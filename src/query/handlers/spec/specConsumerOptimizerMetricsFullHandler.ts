import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetDateRangeFromRequest, GetAndValidateSpecIdFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { ConsumerOptimizerMetricsFullBySpecService } from '@jsinfo/redis/resources/spec/SpecConsumerOptimizerMetricsFull';
import { JSINFO_QUERY_CONSUMER_OPTIMIZER_METRICS_FULL_KEY } from '@jsinfo/query/queryConsts';
import { logger } from '@jsinfo/utils/logger';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { aggregateMetricsResponse, MetricsItem } from '@jsinfo/query/utils/querySpecOptimizerMetricsHandlerUtils';

export const SpecConsumerOptimizerMetricsFullHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: { type: 'string' },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export interface SpecConsumerOptimizerMetricsFullQuery {
    spec: string;
    f?: string;    // Changed from 'from'
    t?: string;    // Changed from 'to'
    metric?: string;
    providers?: string;  // Comma-separated list of provider addresses
    consumer?: string;   // 'all', lava address, or hostname
    key: string;        // Access key for full metrics
}

export async function SpecConsumerOptimizerMetricsFullHandler(request: FastifyRequest<{
    Querystring: SpecConsumerOptimizerMetricsFullQuery
}>, reply: FastifyReply) {
    const { key } = request.query;
    if (key !== JSINFO_QUERY_CONSUMER_OPTIMIZER_METRICS_FULL_KEY) {
        reply.header('Content-Type', 'application/json');
        logger.warn('Invalid key for full metrics access');
        return reply.send(JSONStringify({
            error: 'Access denied'
        }));
    }

    const spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const { from, to } = GetDateRangeFromRequest(request);
    const { metric, providers, consumer } = request.query;

    // Validate dates if provided
    if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
        return reply.send(JSONStringify({ error: 'Invalid date format' }));
    }

    const data = await ConsumerOptimizerMetricsFullBySpecService.fetch({
        spec,
        from,
        to
    });

    reply.header('Content-Type', 'application/json');

    if (!data?.metrics) {
        return reply.send(JSONStringify({
            metrics: [],
            error: 'No metrics found'
        }));
    }

    const response = await aggregateMetricsResponse(
        data.metrics as MetricsItem[],
        spec,
        true,
        {
            metric,
            providers: providers?.split(','),
            consumer,
            from,
            to
        }
    );

    if ('error' in response) {
        return reply.send(JSONStringify({ error: response.error }));
    }

    return reply.send(JSONStringify(response));
} 