import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { avg } from '@jsinfo/utils/math';
import { startOfDay, endOfDay } from 'date-fns';
import { logger } from '@jsinfo/utils/logger';
import { TopProvidersBySpecService } from '@jsinfo/redis/resources/spec/TopProvidersBySpec';

export interface MetricsFilters {
    consumer?: string;
    chain_id?: string;
}

export interface MetricsItem {
    hourly_timestamp: Date;
    consumer: string;
    consumer_hostname: string;
    chain: string;
    metrics_count: number;
    latency_score: number;
    availability_score: number;
    sync_score: number;
    generic_score: number;
    node_error_rate: number;
    entry_index: number;
    provider_stake: number;
    provider: string;
    provider_moniker: string;
    epoch: number;
    tier_sum?: number | null;
    tier_metrics_count?: number;
    tier_average: number;
    tier_chances: {
        tier0: number;
        tier1: number;
        tier2: number;
        tier3: number;
    };
}

export interface BaseAggregatedMetrics {
    hourly_timestamp: Date;
    consumer: string;
    chain_id: string;
    latency_score: number;
    availability_score: number;
    sync_score: number;
    node_error_rate: number;
    entry_index: number;
    generic_score: number;
    provider_stake: number;
    epoch: number;
}

export interface AggregatedMetricsWithTiers extends BaseAggregatedMetrics {
    tier_average: number | null;
    tier_chances: {
        tier0: number | null;
        tier1: number | null;
        tier2: number | null;
        tier3: number | null;
    };
    tier_metrics_count: number;
}

export function getMetricsFilters(query: any): {
    is_consumer_all: boolean;
    is_chain_id_all: boolean;
    consumer: string | undefined;
    chain_id: string | undefined;
} {
    const { consumer, chain_id } = query;
    const is_consumer_all = consumer === 'all' || !consumer || !IsMeaningfulText(consumer);
    const is_chain_id_all = chain_id === 'all' || !chain_id || !IsMeaningfulText(chain_id);

    return {
        is_consumer_all,
        is_chain_id_all,
        consumer: is_consumer_all ? undefined : consumer,
        chain_id: is_chain_id_all ? undefined : chain_id
    };
}

export function getPossibleValues(metrics: any[]) {
    const possibleChainIds = [...new Set(metrics.map(m => m.chain))].filter((id): id is string => id !== null);
    const possibleConsumers = [...new Set(metrics
        .map(m => m.consumer?.startsWith('lava@') ? m.consumer : null)
        .filter((c): c is string => c !== null)
    )];
    const possibleHostnames = [...new Set(metrics
        .map(m => m.consumer_hostname === 'nenad-test' ? 'test_machine' : m.consumer_hostname)
        .filter((h): h is string => h !== null)
    )];

    return {
        possibleChainIds,
        possibleConsumers,
        possibleHostnames
    };
}

export function validateFilters(
    filters: ReturnType<typeof getMetricsFilters>,
    possible: ReturnType<typeof getPossibleValues>
): string | null {
    const { is_consumer_all, is_chain_id_all, consumer, chain_id } = filters;
    const { possibleConsumers, possibleHostnames, possibleChainIds } = possible;

    if (!is_consumer_all && !(possibleConsumers.some(c => c === consumer) || possibleHostnames.some(h => h === consumer))) {
        return 'no match for consumer found';
    }

    if (!is_chain_id_all && !possibleChainIds.some(c => c === chain_id)) {
        return 'no match for chain found';
    }

    return null;
}

export function aggregateMetrics(
    metrics: MetricsItem[],
    consumer: string,
    chain_id: string,
    includeTiers: boolean = false
): BaseAggregatedMetrics[] | AggregatedMetricsWithTiers[] {
    const aggregations = new Map<string, {
        latency_scores: number[],
        availability_scores: number[],
        sync_scores: number[],
        node_error_rates: number[],
        entry_indices: number[],
        generic_scores: number[],
        provider_stake: number,
        epoch: number,
        tier_sum: number[],
        tier_chances: {
            tier0: number[],
            tier1: number[],
            tier2: number[],
            tier3: number[]
        }
    }>();

    for (const metric of metrics) {
        const consumerHostname = metric.consumer_hostname === 'nenad-test' ? 'test_machine' : metric.consumer_hostname;
        if (consumer !== 'all' && metric.consumer !== consumer && consumerHostname !== consumer) continue;

        if (chain_id !== 'all' && metric.chain !== chain_id) continue;

        const key = [
            metric.hourly_timestamp,
            consumer === 'all' ? 'all' : (metric.consumer?.startsWith('lava@') ? metric.consumer : metric.consumer_hostname),
            chain_id === 'all' ? 'all' : metric.chain
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
                epoch: 0,
                tier_sum: [],
                tier_chances: {
                    tier0: [],
                    tier1: [],
                    tier2: [],
                    tier3: []
                }
            });
        }

        const agg = aggregations.get(key)!;

        // Add debug logging
        logger.debug('Processing metric:', {
            timestamp: metric.hourly_timestamp,
            tier_average: metric.tier_average,
            tier_chances: metric.tier_chances,
            key
        });

        // Scores that should be between 0 and 1
        [
            { value: metric.latency_score, array: agg.latency_scores },
            { value: metric.availability_score, array: agg.availability_scores },
            { value: metric.sync_score, array: agg.sync_scores },
            { value: metric.generic_score, array: agg.generic_scores }
        ].forEach(({ value, array }) => {
            const numValue = parseFloat(String(value));
            // set the limit here to 100 - it's 15 in the relays code
            if (numValue >= 0 && numValue <= 100) array.push(numValue);
        });

        // Other metrics without range restriction
        [
            { value: metric.node_error_rate, array: agg.node_error_rates },
            { value: metric.entry_index, array: agg.entry_indices }
        ].forEach(({ value, array }) => {
            const numValue = parseFloat(String(value));
            if (numValue !== 0) array.push(numValue);
        });

        // Update max values
        if (metric.provider_stake) {
            agg.provider_stake = Math.max(agg.provider_stake, parseFloat(String(metric.provider_stake)));
        }
        if (metric.epoch) {
            agg.epoch = Math.max(agg.epoch, parseFloat(String(metric.epoch)));
        }

        // Aggregate tier data directly
        if (metric.tier_average != null) {
            agg.tier_sum.push(parseFloat(String(metric.tier_average)));
        }

        if (metric.tier_chances) {
            if (metric.tier_chances.tier0 != null) agg.tier_chances.tier0.push(parseFloat(String(metric.tier_chances.tier0)));
            if (metric.tier_chances.tier1 != null) agg.tier_chances.tier1.push(parseFloat(String(metric.tier_chances.tier1)));
            if (metric.tier_chances.tier2 != null) agg.tier_chances.tier2.push(parseFloat(String(metric.tier_chances.tier2)));
            if (metric.tier_chances.tier3 != null) agg.tier_chances.tier3.push(parseFloat(String(metric.tier_chances.tier3)));
        }
    }

    return Array.from(aggregations.entries()).map(([key, agg]) => {
        const [timestamp, consumer, chain_id] = key.split(':::');
        const baseMetrics: BaseAggregatedMetrics = {
            hourly_timestamp: new Date(timestamp),
            consumer: consumer,
            chain_id: chain_id,
            latency_score: parseFloat(avg(agg.latency_scores).toFixed(9)),
            availability_score: parseFloat(avg(agg.availability_scores).toFixed(9)),
            sync_score: parseFloat(avg(agg.sync_scores).toFixed(9)),
            node_error_rate: parseFloat(avg(agg.node_error_rates).toFixed(9)),
            entry_index: parseFloat(avg(agg.entry_indices).toFixed(9)),
            generic_score: parseFloat(avg(agg.generic_scores).toFixed(9)),
            provider_stake: parseFloat(String(agg.provider_stake)),
            epoch: parseFloat(String(agg.epoch))
        };

        if (!includeTiers) {
            return baseMetrics;
        }

        return {
            ...baseMetrics,
            tier_average: agg.tier_sum.length > 0 ?
                parseFloat(avg(agg.tier_sum).toFixed(9)) : null,
            tier_chances: {
                tier0: agg.tier_chances.tier0.length > 0 ?
                    parseFloat(avg(agg.tier_chances.tier0).toFixed(9)) : null,
                tier1: agg.tier_chances.tier1.length > 0 ?
                    parseFloat(avg(agg.tier_chances.tier1).toFixed(9)) : null,
                tier2: agg.tier_chances.tier2.length > 0 ?
                    parseFloat(avg(agg.tier_chances.tier2).toFixed(9)) : null,
                tier3: agg.tier_chances.tier3.length > 0 ?
                    parseFloat(avg(agg.tier_chances.tier3).toFixed(9)) : null
            },
            tier_metrics_count: agg.tier_sum.length
        };
    });
}

export function filterMetricsByDateRange<T extends { hourly_timestamp: Date }>(
    metrics: T[],
    from: Date | undefined,
    to: Date | undefined
): T[] {
    if (!from && !to) return metrics;

    const fromDate = from ? startOfDay(from) : undefined;
    const toDate = to ? endOfDay(to) : undefined;

    return metrics.filter(metric => {
        if (fromDate && metric.hourly_timestamp < fromDate) return false;
        if (toDate && metric.hourly_timestamp > toDate) return false;
        return true;
    });
}

export function isDateInRange(date: Date, from: Date | undefined, to: Date | undefined): boolean {
    if (!from && !to) return true;

    const metricDate = new Date(date);
    const metricDay = new Date(Date.UTC(
        metricDate.getUTCFullYear(),
        metricDate.getUTCMonth(),
        metricDate.getUTCDate(),
        metricDate.getUTCHours(),
        metricDate.getUTCMinutes(),
        metricDate.getUTCSeconds()
    ));

    if (from && metricDay < from) return false;
    if (to && metricDay > to) return false;

    return true;
}

export function filterMetricsByExactDates<T extends { hourly_timestamp: Date }>(
    metrics: T[],
    from: Date | undefined,
    to: Date | undefined
): T[] {
    if (!from && !to) return metrics;
    return metrics.filter(metric => isDateInRange(metric.hourly_timestamp, from, to));
}

