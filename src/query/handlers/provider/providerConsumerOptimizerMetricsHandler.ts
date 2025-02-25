// src/query/handlers/provider/providerConsumerOptimizerMetricsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ConsumerOptimizerMetricsByProviderService } from '@jsinfo/redis/resources/ProviderConsumerOptimizerMetrics/ProviderConsumerOptimizerMetrics';
import { GetAndValidateProviderAddressFromRequest, GetDateRangeFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { getMetricsFilters, getPossibleValues, validateFilters, aggregateMetrics, MetricsItem } from '@jsinfo/query/utils/queryProviderOptimizerMetricsHandlerUtils';

export const ProviderConsumerOptimizerMetricsHandlerOpts: RouteShorthandOptions = {
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

export interface ProviderConsumerOptimizerMetricsQuery {
    consumer?: string;
    chain_id?: string;
    from?: string;
    to?: string;
}

export async function ProviderConsumerOptimizerMetricsHandler(request: FastifyRequest, reply: FastifyReply) {
    const provider = await GetAndValidateProviderAddressFromRequest("ProviderConsumerOptimizerMetricsHandler", request, reply);
    if (provider === '') {
        return reply;
    }

    const { from, to } = GetDateRangeFromRequest(request);
    const filters = getMetricsFilters(request.query);

    const data = await ConsumerOptimizerMetricsByProviderService.fetch({
        provider,
        from,
        to
    });

    reply.header('Content-Type', 'application/json');

    if (!data?.metrics) {
        return reply.send(JSONStringify({ error: 'No metrics found' }));
    }

    const possible = getPossibleValues(data.metrics);
    const validationError = validateFilters(filters, possible);
    if (validationError) {
        return reply.send(JSONStringify({ error: validationError }));
    }

    const aggMetrics = aggregateMetrics(
        data.metrics as MetricsItem[],
        filters.is_consumer_all ? 'all' : filters.consumer!,
        filters.is_chain_id_all ? 'all' : filters.chain_id!,
        false // don't include tiers
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