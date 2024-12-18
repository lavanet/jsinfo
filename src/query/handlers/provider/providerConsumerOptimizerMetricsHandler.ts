// src/query/handlers/provider/providerConsumerOptimizerMetricsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ConsumerOptimizerMetricsService } from '@jsinfo/redis/resources/provider/consumerOptimizerMetrics';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
import { ConsumerOptimizerMetricsAgg } from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { avg } from '@jsinfo/utils/math';

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

export interface ProviderConsumerOptimizerMetricsQuery {
    consumer?: string;
    chain_id?: string;
    from?: string;
    to?: string;
}

export async function ProviderConsumerOptimizerMetricsHandler(
    request: FastifyRequest<{ Querystring: ProviderConsumerOptimizerMetricsQuery }>,
    reply: FastifyReply
) {
    const { consumer, chain_id, from, to } = request.query;

    const provider = await GetAndValidateProviderAddressFromRequest("ProviderConsumerOptimizerMetricsHandler", request, reply);
    if (provider === '') {
        return reply;
    }

    const is_consumer_all = consumer === 'all' || !consumer || !IsMeaningfulText(consumer);
    const is_chain_id_all = chain_id === 'all' || !chain_id || !IsMeaningfulText(chain_id);

    const data = await ConsumerOptimizerMetricsService.fetch({
        provider,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined
    });

    reply.header('Content-Type', 'application/json');

    if (!data?.metrics) {
        return reply.send(JSONStringify({ error: 'No metrics found' }));
    }

    const possibleChainIds = [...new Set(data.metrics.map(m => m.chain_id))].filter((id): id is string => id !== null);
    const possibleConsumers = [...new Set(data.metrics
        .map(m => m.consumer?.startsWith('lava@') ? m.consumer : null)
        .filter((c): c is string => c !== null)
    )];
    const possibleHostnames = [...new Set(data.metrics
        .map(m => m.consumer_hostname === 'nenad-test' ? 'test_machine' : m.consumer_hostname)
        .filter((h): h is string => h !== null)
    )];

    if (!is_consumer_all && !(possibleConsumers.some(c => c === consumer) || possibleHostnames.some(h => h === consumer))) {
        return reply.send(JSONStringify({ error: 'no match for consumer found' }));
    }

    if (!is_chain_id_all && !possibleChainIds.some(c => c === chain_id)) {
        return reply.send(JSONStringify({ error: 'no match for chain found' }));
    }

    const aggMetrics = aggregateMetrics(data.metrics, is_consumer_all ? 'all' : consumer, is_chain_id_all ? 'all' : chain_id);

    const ret = {
        metrics: aggMetrics,
        filters: {
            consumer: is_consumer_all ? 'all' : consumer,
            chain_id: is_chain_id_all ? 'all' : chain_id,
            from: data.filters.from,
            to: data.filters.to,
            provider: provider
        },
        possibleChainIds,
        possibleConsumers: [...possibleConsumers, ...possibleHostnames]
    }

    return reply.send(JSONStringify(ret));
}

interface AggregatedMetrics {
    timestamp: Date | null;
    consumer: string | null;
    chain_id: string | null;
    latency_score: string;
    availability_score: string;
    sync_score: string;
    node_error_rate: string;
    entry_index: string;
    generic_score: string;
    provider_stake: number;
    epoch: number;
}

function aggregateMetrics(metrics: ConsumerOptimizerMetricsAgg[], consumer: string, chain_id: string): AggregatedMetrics[] {
    const aggregations = new Map<string, {
        latency_scores: number[],
        availability_scores: number[],
        sync_scores: number[],
        node_error_rates: number[],
        entry_indices: number[],
        generic_scores: number[],
        provider_stake: number,
        epoch: number
    }>();

    for (const metric of metrics) {
        const consumerHostname = metric.consumer_hostname === 'nenad-test' ? 'test_machine' : metric.consumer_hostname;
        if (consumer !== 'all' && metric.consumer !== consumer && consumerHostname !== consumer) continue;

        if (chain_id !== 'all' && metric.chain_id !== chain_id) continue;

        const key = [
            metric.timestamp,
            consumer === 'all' ? 'all' : (metric.consumer?.startsWith('lava@') ? metric.consumer : metric.consumer_hostname),
            chain_id === 'all' ? 'all' : metric.chain_id
        ].join(':::');

        if (!aggregations.has(key)) {
            aggregations.set(key, {
                latency_scores: [],
                availability_scores: [],
                sync_scores: [],
                node_error_rates: [],
                entry_indices: [],
                generic_scores: [],
                provider_stake: 0,
                epoch: 0
            });
        }

        const agg = aggregations.get(key)!;

        [
            { value: metric.latency_score, array: agg.latency_scores },
            { value: metric.availability_score, array: agg.availability_scores },
            { value: metric.sync_score, array: agg.sync_scores },
            { value: metric.node_error_rate, array: agg.node_error_rates },
            { value: metric.entry_index, array: agg.entry_indices },
            { value: metric.generic_score, array: agg.generic_scores }
        ].forEach(({ value, array }) => {
            const numValue = Number(value);
            if (numValue !== 0) array.push(numValue);
        });

        // Update max values
        if (metric.provider_stake) {
            agg.provider_stake = Math.max(agg.provider_stake, metric.provider_stake);
        }
        if (metric.epoch) {
            agg.epoch = Math.max(agg.epoch, metric.epoch);
        }
    }

    return Array.from(aggregations.entries()).map(([key, agg]) => {
        const [timestamp, consumer, chain_id] = key.split(':::');
        return {
            timestamp: new Date(timestamp),
            consumer: consumer,
            chain_id: chain_id,
            latency_score: String(avg(agg.latency_scores)),
            availability_score: String(avg(agg.availability_scores)),
            sync_score: String(avg(agg.sync_scores)),
            node_error_rate: String(avg(agg.node_error_rates)),
            entry_index: String(avg(agg.entry_indices)),
            generic_score: String(avg(agg.generic_scores)),
            provider_stake: agg.provider_stake,
            epoch: agg.epoch
        };
    });
}