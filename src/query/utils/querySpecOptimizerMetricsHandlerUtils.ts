import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { avg } from '@jsinfo/utils/math';
import { startOfDay, endOfDay } from 'date-fns';
import { logger } from '@jsinfo/utils/logger';
import { TopProvidersBySpecService } from '@jsinfo/redis/resources/spec/TopProvidersBySpec';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';

export interface MetricsFilters {
    metric?: string;
    providers?: string[];
    consumer?: string;
    from?: Date;
    to?: Date;
}

export interface MetricsItem {
    hourly_timestamp: Date;
    consumer: string;
    consumer_hostname: string;
    metrics_count: number;
    provider_stake: number;
    provider: string;
    provider_moniker: string;
    latency_score: number;
    availability_score: number;
    sync_score: number;
    generic_score: number;
    node_error_rate: number;
    entry_index: number;
    epoch: number;
    // Optional fields for full metrics
    tier_average?: number;
    tier_chances?: {
        tier0: number;
        tier1: number;
        tier2: number;
        tier3: number;
    };
}

export interface BaseAggregatedMetrics {
    hourly_timestamp: Date;
    consumer: string;
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

export interface MetricScoreTypes {
    latency_score: number;
    availability_score: number;
    sync_score: number;
    generic_score: number;
    node_error_rate: number;
    entry_index: number;
}

export type MetricScoreType = keyof MetricScoreTypes;

export interface ProviderAverages {
    provider: string;
    provider_moniker: string;
    average_generic_score: number;
    metrics_count: number;
    averages: {
        latency_score: number;
        availability_score: number;
        sync_score: number;
        generic_score: number;
        node_error_rate: number;
        entry_index: number;
    };
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

        const key = [
            metric.hourly_timestamp,
            consumer === 'all' ? 'all' : (metric.consumer?.startsWith('lava@') ? metric.consumer : metric.consumer_hostname)
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
        const [timestamp, consumer] = key.split(':::');
        const baseMetrics: BaseAggregatedMetrics = {
            hourly_timestamp: new Date(timestamp),
            consumer: consumer,
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

export function isDateInRange(date: Date, from?: Date, to?: Date): boolean {
    if (!from && !to) return true;

    const timestamp = new Date(date).getTime();
    if (from && timestamp < from.getTime()) return false;
    if (to && timestamp > to.getTime()) return false;

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

export function getTopProvidersByScore(
    metrics: MetricsItem[],
    scoreType: MetricScoreType = 'generic_score',
    limit: number = 10
): ProviderAverages[] {
    const providerMetrics = new Map<string, {
        scores: MetricScoreTypes;
        count: number;
        moniker: string;
    }>();

    // Aggregate scores by provider
    metrics.forEach(metric => {
        const key = metric.provider;
        if (!providerMetrics.has(key)) {
            providerMetrics.set(key, {
                scores: {
                    latency_score: 0,
                    availability_score: 0,
                    sync_score: 0,
                    generic_score: 0,
                    node_error_rate: 0,
                    entry_index: 0
                },
                count: 0,
                moniker: metric.provider_moniker
            });
        }

        const provider = providerMetrics.get(key)!;
        Object.keys(provider.scores).forEach(key => {
            const metricKey = key as MetricScoreType;
            provider.scores[metricKey] += metric[metricKey];
        });
        provider.count++;
    });

    // Calculate averages and sort
    return Array.from(providerMetrics.entries())
        .map(([provider, data]) => ({
            provider,
            provider_moniker: data.moniker,
            average_generic_score: data.scores.generic_score / data.count,
            metrics_count: data.count,
            averages: {
                latency_score: data.scores.latency_score / data.count,
                availability_score: data.scores.availability_score / data.count,
                sync_score: data.scores.sync_score / data.count,
                generic_score: data.scores.generic_score / data.count,
                node_error_rate: data.scores.node_error_rate / data.count,
                entry_index: data.scores.entry_index / data.count
            }
        }))
        .sort((a, b) => b.averages[scoreType] - a.averages[scoreType])
        .slice(0, limit);
}

export async function getTopProviders(spec: string): Promise<string[]> {
    const result = await TopProvidersBySpecService.fetch({ spec });
    if (!result || result.error || !result.providers) {
        return [];
    }
    return Object.keys(result.providers);
}

export async function getTopProvidersWithMonikers(spec: string): Promise<{ [key: string]: string } | null> {
    const result = await TopProvidersBySpecService.fetch({ spec });
    if (!result || result.error) {
        return null;
    }
    return result.providers || {};
}

export function filterMetricsByProviders(
    metrics: MetricsItem[],
    providers: string[]
): MetricsItem[] {
    if (!providers.length) return metrics;
    return metrics.filter(m => providers.includes(m.provider));
}

export function filterMetricsByConsumer(
    metrics: MetricsItem[],
    consumer?: string,
    hostname?: string
): MetricsItem[] {
    if (!consumer && !hostname) return metrics;
    return metrics.filter(m => {
        if (consumer && m.consumer === consumer) return true;
        if (hostname && m.consumer_hostname === hostname) return true;
        return false;
    });
}

export function calculateProviderAverages(
    metrics: MetricsItem[],
    includeProviderAverage: boolean = false
): Record<string, MetricScoreTypes[]> {
    const providerMetrics: Record<string, MetricScoreTypes[]> = {};

    metrics.forEach(metric => {
        const key = includeProviderAverage ? 'average' : metric.provider;
        if (!providerMetrics[key]) {
            providerMetrics[key] = [];
        }

        providerMetrics[key].push({
            latency_score: metric.latency_score,
            availability_score: metric.availability_score,
            sync_score: metric.sync_score,
            generic_score: metric.generic_score,
            node_error_rate: metric.node_error_rate,
            entry_index: metric.entry_index
        });
    });

    return providerMetrics;
}

export const AVAILABLE_METRICS = {
    latency_score: "Latency Score",
    availability_score: "Availability Score",
    sync_score: "Sync Score",
    generic_score: "Reputation Score",
    node_error_rate: "Error Rate",
    entry_index: "Entry Index"
} as const;

export const AVAILABLE_METRICS_FULL = {
    ...AVAILABLE_METRICS,
    tier_average: "Tier Average",
    tier_chances_tier0: "Tier 0 Chance",
    tier_chances_tier1: "Tier 1 Chance",
    tier_chances_tier2: "Tier 2 Chance",
    tier_chances_tier3: "Tier 3 Chance",
    provider_stake: "Provider Stake",
    metrics_count: "Metrics Count",
    epoch: "Epoch"
} as const;

export interface MetricsResponse {
    metrics: Array<{
        provider_moniker: string;
        hourly_timestamp: Date;
        score: number;
    }>;
    filters: {
        options: {
            metrics: typeof AVAILABLE_METRICS | typeof AVAILABLE_METRICS_FULL;
            providers: {
                top: { [key: string]: string };
                all: { [key: string]: string };
            };
            consumers: {
                lavaIds: string[];
                hostnames: string[];
            };
        };
        selected: {
            metric: string;
            providers: string[];
            consumer: string;
        };
    };
}

export async function aggregateMetricsResponse(
    metrics: MetricsItem[],
    spec: string,
    isFull: boolean = false,
    filters: MetricsFilters = {}
): Promise<MetricsResponse | { error: string }> {
    const { metric = 'generic_score', providers, consumer, from, to } = filters;

    // Validate dates
    if (from && isNaN(from.getTime())) {
        return { error: 'Invalid from date' };
    }
    if (to && isNaN(to.getTime())) {
        return { error: 'Invalid to date' };
    }

    // Validate metric
    const availableMetrics = isFull ? AVAILABLE_METRICS_FULL : AVAILABLE_METRICS;
    if (!(metric in availableMetrics)) {
        return { error: `Invalid metric. Must be one of: ${Object.keys(availableMetrics).join(', ')}` };
    }

    // Get top providers from TopProvidersBySpec service
    const topProvidersResult = await TopProvidersBySpecService.fetch({ spec });
    if (!topProvidersResult || topProvidersResult.error) {
        return { error: 'Failed to fetch top providers' };
    }

    // Get all providers from the metrics
    const allProviders = [...new Set(metrics.map(m => m.provider))];
    const allProvidersWithMonikers: { [key: string]: string } = {};

    // Get monikers for all providers in metrics
    for (const provider of allProviders) {
        if (provider) {
            const moniker = await ProviderMonikerService.GetMonikerForSpec(provider, spec);
            allProvidersWithMonikers[provider] = moniker || provider;
        }
    }

    // Filter by date range first
    let filteredMetrics = metrics;
    if (from || to) {
        const beforeCount = filteredMetrics.length;
        filteredMetrics = filteredMetrics.filter(m =>
            isDateInRange(m.hourly_timestamp, from, to)
        );
        logger.debug('Date filtering', {
            beforeCount,
            afterCount: filteredMetrics.length,
            fromDate: from?.toISOString(),
            toDate: to?.toISOString(),
            firstDate: filteredMetrics[0]?.hourly_timestamp,
            lastDate: filteredMetrics[filteredMetrics.length - 1]?.hourly_timestamp
        });
    }

    // Filter by providers if specified
    if (providers?.length) {
        filteredMetrics = filteredMetrics.filter(m => providers.includes(m.provider));
    }

    // Filter by consumer if specified
    if (consumer && consumer !== 'all') {
        filteredMetrics = filteredMetrics.filter(m => {
            if (consumer.startsWith('lava@')) {
                return m.consumer === consumer;
            }
            return m.consumer_hostname === consumer;
        });
    }

    // Aggregate metrics by provider and timestamp
    const aggregatedMetrics = new Map<string, any>();

    // Add special "all providers" entry for each timestamp
    const timestampGroups = new Map<string, any[]>();

    filteredMetrics.forEach(m => {
        // Ensure timestamp is a Date object
        const timestamp = m.hourly_timestamp instanceof Date
            ? m.hourly_timestamp.toISOString()
            : new Date(m.hourly_timestamp).toISOString();

        // Group metrics by timestamp for "all providers" calculation
        if (!timestampGroups.has(timestamp)) {
            timestampGroups.set(timestamp, []);
        }
        timestampGroups.get(timestamp)!.push(m);

        // Regular provider-specific aggregation
        const key = `${m.provider}_${timestamp}`;
        if (!aggregatedMetrics.has(key)) {
            aggregatedMetrics.set(key, {
                provider_moniker: allProvidersWithMonikers[m.provider] || m.provider,
                hourly_timestamp: new Date(timestamp),
                score: 0,
                metrics_count: 0
            });
        }

        const agg = aggregatedMetrics.get(key)!;
        const score = m[metric] * m.metrics_count;
        if (!isNaN(score)) {  // Only add valid scores
            agg.score += score;
            agg.metrics_count += m.metrics_count;
        }
    });

    // Calculate "all providers" averages for each timestamp
    timestampGroups.forEach((metrics, timestamp) => {
        // Only include metrics with valid scores in the calculation
        const validMetrics = metrics.filter(m =>
            m[metric] !== null &&
            m[metric] !== undefined &&
            !isNaN(m[metric]) &&
            m[metric] !== 0
        );

        if (validMetrics.length > 0) {  // Only proceed if we have valid metrics
            const totalScore = validMetrics.reduce((sum, m) =>
                sum + (m[metric] * m.metrics_count), 0);
            const totalCount = validMetrics.reduce((sum, m) =>
                sum + m.metrics_count, 0);

            if (totalCount > 0 && totalScore > 0) {  // Only add entry if we have valid scores
                aggregatedMetrics.set(`all_${timestamp}`, {
                    provider_moniker: 'All Providers',
                    hourly_timestamp: new Date(timestamp),
                    score: totalScore / totalCount,
                    metrics_count: totalCount
                });
            }
        }
    });

    // Calculate averages and filter out invalid entries
    const aggregatedMetricsArray = Array.from(aggregatedMetrics.values())
        .map(m => ({
            provider_moniker: m.provider_moniker,
            hourly_timestamp: m.hourly_timestamp,
            score: m.provider_moniker === 'All Providers' ? m.score : m.score / m.metrics_count
        }))
        // Filter out entries with null, undefined, zero or NaN scores
        .filter(m =>
            m.score !== null &&
            m.score !== undefined &&
            !isNaN(m.score) &&
            m.score !== 0
        );

    // Get unique consumers and hostnames from original metrics for filter options
    const lavaIds = [...new Set(metrics.map(m => m.consumer))]
        .filter(c => c.startsWith('lava@'));
    const hostnames = [...new Set(metrics.map(m => m.consumer_hostname))];

    return {
        metrics: aggregatedMetricsArray,
        filters: {
            options: {
                metrics: availableMetrics,
                providers: {
                    top: topProvidersResult.providers || {},
                    all: allProvidersWithMonikers
                },
                consumers: {
                    lavaIds,
                    hostnames
                }
            },
            selected: {
                metric,
                providers: providers || Object.keys(topProvidersResult.providers || {}),
                consumer: consumer || 'all'
            }
        }
    };
} 