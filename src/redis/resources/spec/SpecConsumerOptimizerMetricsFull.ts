// src/redis/resources/provider/consumerOptimizerMetrics.ts

import { and, eq, gte, lte } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
import { queryRelays } from '@jsinfo/utils/db';
import { aggregatedConsumerOptimizerMetrics } from '@jsinfo/schemas/relaysSchema';
import { logger } from '@jsinfo/utils/logger';
import { SpecAndConsumerService } from '../global/SpecAndConsumerResource';
import { ProviderMonikerService } from '../global/ProviderMonikerSpecResource';

export interface ConsumerOptimizerMetricsFullBySpecFilterParams {
    spec: string;
    from?: Date;
    to?: Date;
}

export interface ConsumerOptimizerMetricsFullBySpecItem {
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
    tier_average: number;
    tier_chances: {
        tier0: number;
        tier1: number;
        tier2: number;
        tier3: number;
    };
}

export interface ConsumerOptimizerMetricsFullBySpecResponse {
    filters: {
        spec?: string;
        from?: Date;
        to?: Date;
    };
    metrics: ConsumerOptimizerMetricsFullBySpecItem[];
    error?: string;
}

export class ConsumerOptimizerMetricsFullBySpecResource extends RedisResourceBase<ConsumerOptimizerMetricsFullBySpecResponse, ConsumerOptimizerMetricsFullBySpecFilterParams> {
    protected readonly redisKey = 'consumer_optimizer_metrics_full_by_spec';
    protected readonly cacheExpirySeconds = 1200; // 20 minutes

    protected async fetchFromSource(args: ConsumerOptimizerMetricsFullBySpecFilterParams): Promise<ConsumerOptimizerMetricsFullBySpecResponse> {
        const spec = args.spec;

        let to = args?.to || new Date();
        let from = args?.from || new Date(new Date().setMonth(new Date().getMonth() - 1));

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        if (from < threeMonthsAgo) {
            from = threeMonthsAgo;
        }

        if (to < from) {
            [to, from] = [from, to];
        }

        if (!spec || !IsMeaningfulText(spec)) {
            return {
                filters: { ...args, from, to },
                metrics: [],
                error: 'Invalid spec (empty)'
            };
        }

        const isValidSpec = await SpecAndConsumerService.IsValidSpec(spec);
        if (!isValidSpec) {
            return {
                filters: { ...args, from, to },
                metrics: [],
                error: 'Invalid spec (not found)'
            };
        }

        const metrics = await this.getAggregatedMetrics(spec, from, to);

        return {
            filters: { ...args, from, to },
            metrics: metrics
        };
    }

    private async getAggregatedMetrics(spec: string, from: Date, to: Date): Promise<ConsumerOptimizerMetricsFullBySpecItem[]> {
        const metrics = await queryRelays(db =>
            db.select({
                provider: aggregatedConsumerOptimizerMetrics.provider,
                hourly_timestamp: aggregatedConsumerOptimizerMetrics.hourly_timestamp,
                consumer: aggregatedConsumerOptimizerMetrics.consumer,
                consumer_hostname: aggregatedConsumerOptimizerMetrics.consumer_hostname,
                metrics_count: aggregatedConsumerOptimizerMetrics.metrics_count,
                latency_score_sum: aggregatedConsumerOptimizerMetrics.latency_score_sum,
                availability_score_sum: aggregatedConsumerOptimizerMetrics.availability_score_sum,
                sync_score_sum: aggregatedConsumerOptimizerMetrics.sync_score_sum,
                generic_score_sum: aggregatedConsumerOptimizerMetrics.generic_score_sum,
                node_error_rate_sum: aggregatedConsumerOptimizerMetrics.node_error_rate_sum,
                entry_index_sum: aggregatedConsumerOptimizerMetrics.entry_index_sum,
                provider_stake: aggregatedConsumerOptimizerMetrics.max_provider_stake,
                max_epoch: aggregatedConsumerOptimizerMetrics.max_epoch,
                tier_sum: aggregatedConsumerOptimizerMetrics.tier_sum,
                tier_metrics_count: aggregatedConsumerOptimizerMetrics.tier_metrics_count,
                tier_chance_0_sum: aggregatedConsumerOptimizerMetrics.tier_chance_0_sum,
                tier_chance_1_sum: aggregatedConsumerOptimizerMetrics.tier_chance_1_sum,
                tier_chance_2_sum: aggregatedConsumerOptimizerMetrics.tier_chance_2_sum,
                tier_chance_3_sum: aggregatedConsumerOptimizerMetrics.tier_chance_3_sum,
            })
                .from(aggregatedConsumerOptimizerMetrics)
                .where(and(
                    eq(aggregatedConsumerOptimizerMetrics.chain, spec),
                    gte(aggregatedConsumerOptimizerMetrics.hourly_timestamp, from),
                    lte(aggregatedConsumerOptimizerMetrics.hourly_timestamp, to)
                ))
                .orderBy(aggregatedConsumerOptimizerMetrics.hourly_timestamp)
            , `ConsumerOptimizerMetricsFullBySpecResource::getAggregatedMetrics_${spec}_${from}_${to}`);

        const validMetrics: ConsumerOptimizerMetricsFullBySpecItem[] = [];

        // Get provider monikers for each unique provider
        const uniqueProviders = [...new Set(metrics.map(m => m.provider))];
        const monikerMap = new Map<string, string>();

        for (const provider of uniqueProviders) {
            if (provider) {
                const moniker = await ProviderMonikerService.GetMonikerForSpec(provider, spec);
                monikerMap.set(provider, moniker || provider);
            }
        }

        for (const m of metrics) {
            if (m.provider === null ||
                m.provider_stake === null ||
                m.latency_score_sum === null ||
                m.availability_score_sum === null ||
                m.sync_score_sum === null ||
                m.generic_score_sum === null ||
                m.node_error_rate_sum === null ||
                m.entry_index_sum === null ||
                m.metrics_count === null ||
                m.consumer === null ||
                m.consumer_hostname === null) {
                logger.warn(`ConsumerOptimizerMetricsFullBySpecResource::getAggregatedMetrics_${spec}_${from}_${to} - Invalid metric(0): ${JSONStringify(m)}`);
                continue;
            }

            if (!IsMeaningfulText(m.latency_score_sum) &&
                !IsMeaningfulText(m.availability_score_sum) &&
                !IsMeaningfulText(m.sync_score_sum) &&
                !IsMeaningfulText(m.generic_score_sum) &&
                !IsMeaningfulText(m.metrics_count + "") &&
                !IsMeaningfulText(m.consumer) &&
                !IsMeaningfulText(m.consumer_hostname) &&
                !IsMeaningfulText(m.provider_stake + "") &&
                !IsMeaningfulText(m.provider)) {
                logger.warn(`ConsumerOptimizerMetricsFullBySpecResource::getAggregatedMetrics_${spec}_${from}_${to} - Invalid metric(1): ${JSONStringify(m)}`);
                continue;
            }

            validMetrics.push({
                provider: m.provider,
                provider_moniker: monikerMap.get(m.provider) || m.provider,
                hourly_timestamp: m.hourly_timestamp,
                consumer: m.consumer,
                consumer_hostname: m.consumer_hostname,
                metrics_count: m.metrics_count,
                provider_stake: m.provider_stake,
                latency_score: Number(m.latency_score_sum) / Number(m.metrics_count),
                availability_score: Number(m.availability_score_sum) / Number(m.metrics_count),
                sync_score: Number(m.sync_score_sum) / Number(m.metrics_count),
                generic_score: Number(m.generic_score_sum) / Number(m.metrics_count),
                node_error_rate: Number(m.node_error_rate_sum) / Number(m.metrics_count),
                entry_index: Number(m.entry_index_sum) / Number(m.metrics_count),
                epoch: Number(m.max_epoch),
                tier_average: (m.tier_metrics_count ?? 0) > 0 && m.tier_sum != null ?
                    Number(m.tier_sum) / Number(m.tier_metrics_count) : 0,
                tier_chances: {
                    tier0: (m.tier_metrics_count ?? 0) > 0 && m.tier_chance_0_sum != null ?
                        Number(m.tier_chance_0_sum) / Number(m.tier_metrics_count) : 0,
                    tier1: (m.tier_metrics_count ?? 0) > 0 && m.tier_chance_1_sum != null ?
                        Number(m.tier_chance_1_sum) / Number(m.tier_metrics_count) : 0,
                    tier2: (m.tier_metrics_count ?? 0) > 0 && m.tier_chance_2_sum != null ?
                        Number(m.tier_chance_2_sum) / Number(m.tier_metrics_count) : 0,
                    tier3: (m.tier_metrics_count ?? 0) > 0 && m.tier_chance_3_sum != null ?
                        Number(m.tier_chance_3_sum) / Number(m.tier_metrics_count) : 0,
                }
            });
        }

        return validMetrics;
    };
}

export const ConsumerOptimizerMetricsFullBySpecService = new ConsumerOptimizerMetricsFullBySpecResource();

