import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest, GetDateRangeFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { ConsumerOptimizerMetricsFullByProviderService } from '@jsinfo/redis/resources/ProviderConsumerOptimizerMetrics/ProviderConsumerOptimizerMetricsFull';
import { JSINFO_QUERY_CONSUMER_OPTIMIZER_METRICS_FULL_KEY } from '@jsinfo/query/queryConsts';
import { logger } from '@jsinfo/utils/logger';
import { getMetricsFilters, getPossibleValues, validateFilters, aggregateMetrics, filterMetricsByDateRange, filterMetricsByExactDates, MetricsItem } from '@jsinfo/query/utils/queryProviderOptimizerMetricsHandlerUtils';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const ProviderConsumerOptimizerMetricsFullHandlerOpts: RouteShorthandOptions = {
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

export async function ProviderConsumerOptimizerMetricsFullHandler(request: FastifyRequest, reply: FastifyReply) {
    const key = (request.query as any).key;
    if (key !== JSINFO_QUERY_CONSUMER_OPTIMIZER_METRICS_FULL_KEY) {
        reply.header('Content-Type', 'application/json');
        logger.warn('Invalid key for full metrics access');
        return reply.send(JSONStringify({
            error: 'Access denied'
        }));
    }

    const provider = await GetAndValidateProviderAddressFromRequest("ProviderConsumerOptimizerMetricsFull", request, reply);
    if (provider === '') {
        return null;
    }

    const { from, to } = GetDateRangeFromRequest(request);
    const filters = getMetricsFilters(request.query);

    const data = await ConsumerOptimizerMetricsFullByProviderService.fetch({
        provider,
        from,
        to
    });

    reply.header('Content-Type', 'application/json');

    if (!data?.metrics) {
        return reply.send(JSONStringify({
            filters: {},
            metrics: [],
            error: 'No metrics found'
        }));
    }

    // Filter metrics by exact dates (ignoring time)
    const filteredMetrics = filterMetricsByExactDates(data.metrics, from, to);

    const possible = getPossibleValues(filteredMetrics);
    const validationError = validateFilters(filters, possible);
    if (validationError) {
        return reply.send(JSONStringify({
            filters: {},
            metrics: [],
            error: validationError
        }));
    }

    const aggMetrics = aggregateMetrics(
        filteredMetrics as MetricsItem[],
        filters.is_consumer_all ? 'all' : filters.consumer!,
        filters.is_chain_id_all ? 'all' : filters.chain_id!,
        true // include tiers
    );

    return reply.send(JSONStringify({
        metrics: aggMetrics,
        filters: {
            consumer: filters.is_consumer_all ? 'all' : filters.consumer,
            chain_id: filters.is_chain_id_all ? 'all' : filters.chain_id,
            from: data.filters.from,
            to: data.filters.to,
            provider: provider
        },
        possibleChainIds: possible.possibleChainIds,
        possibleConsumers: [...possible.possibleConsumers, ...possible.possibleHostnames]
    }));
} 