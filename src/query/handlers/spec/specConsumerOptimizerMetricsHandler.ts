// src/query/handlers/spec/specConsumerOptimizerMetricsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ConsumerOptimizerMetricsBySpecService } from '@jsinfo/redis/resources/spec/SpecConsumerOptimizerMetrics';
import { GetDateRangeFromRequest, GetAndValidateSpecIdFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { aggregateMetricsResponse } from '@jsinfo/query/utils/querySpecOptimizerMetricsHandlerUtils';
import { MetricsItem } from '@jsinfo/query/utils/querySpecOptimizerMetricsHandlerUtils';

export const SpecConsumerOptimizerMetricsHandlerOpts: RouteShorthandOptions = {
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

export interface SpecConsumerOptimizerMetricsQuery {
    spec: string;
    f?: string;    // Changed from 'from'
    t?: string;    // Changed from 'to'
    metric?: string;
    providers?: string;  // Comma-separated list of provider addresses
    consumer?: string;   // 'all', lava address, or hostname
}

export async function SpecConsumerOptimizerMetricsHandler(request: FastifyRequest<{
    Querystring: SpecConsumerOptimizerMetricsQuery
}>, reply: FastifyReply) {
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

    const metricsData = await ConsumerOptimizerMetricsBySpecService.fetch({
        spec,
        from,
        to
    });

    reply.header('Content-Type', 'application/json');

    const response = await aggregateMetricsResponse(
        (metricsData?.metrics || []) as MetricsItem[],
        spec,
        false,
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