// src/redis/resources/provider/consumerOptimizerMetrics.ts

import { and, eq, gte, lte } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
import { ProviderMonikerService } from '../global/ProviderMonikerSpecResource';
import { queryRelays } from '@jsinfo/utils/db';
import { aggregatedConsumerOptimizerMetrics } from '@jsinfo/schemas/relaysSchema';
import { logger } from '@jsinfo/utils/logger';

export interface ConsumerOptimizerMetricsByProviderFilterParams {
    provider: string;
    from?: Date;
    to?: Date;
}

export interface ConsumerOptimizerMetricsByProviderItem {
    hourly_timestamp: Date;
    consumer: string;
    consumer_hostname: string;
    metrics_count: number;
    provider_stake: number;
    latency_score: number;
    availability_score: number;
    sync_score: number;
    generic_score: number;
    node_error_rate: number;
    entry_index: number;
    chain: string;
    epoch: number;
}

export interface ConsumerOptimizerMetricsByProviderResponse {
    filters: {
        provider?: string;
        from?: Date;
        to?: Date;
    };
    metrics: ConsumerOptimizerMetricsByProviderItem[];
    error?: string;
}

export class ConsumerOptimizerMetricsByProviderResource extends RedisResourceBase<ConsumerOptimizerMetricsByProviderResponse, ConsumerOptimizerMetricsByProviderFilterParams> {
    protected readonly redisKey = 'consumer_optimizer_metrics_by_provider';
    protected readonly cacheExpirySeconds = 1200; // 20 minutes

    protected async fetchFromSource(args: ConsumerOptimizerMetricsByProviderFilterParams): Promise<ConsumerOptimizerMetricsByProviderResponse> {
        const provider = args.provider;

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

        if (!provider || !IsMeaningfulText(provider)) {
            return {
                filters: { ...args, from, to },
                metrics: [],
                error: 'Invalid provider (empty)'
            };
        }

        const isValidProvider = await ProviderMonikerService.IsValidProvider(provider);
        if (!isValidProvider) {
            return {
                filters: { ...args, from, to },
                metrics: [],
                error: 'Invalid provider (not found)'
            };
        }

        const metrics = await this.getAggregatedMetrics(provider, from, to);

        return {
            filters: { ...args, from, to },
            metrics: metrics
        };
    }

    private async getAggregatedMetrics(provider: string, from: Date, to: Date): Promise<ConsumerOptimizerMetricsByProviderItem[]> {
        // logger.info('Fetching metrics with date range:', {
        //     provider,
        //     from: from.toISOString(),
        //     to: to.toISOString()
        // });

        const metrics = await queryRelays(db =>
            db.select({
                chain: aggregatedConsumerOptimizerMetrics.chain,
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
                max_epoch: aggregatedConsumerOptimizerMetrics.max_epoch
            })
                .from(aggregatedConsumerOptimizerMetrics)
                .where(and(
                    eq(aggregatedConsumerOptimizerMetrics.provider, provider),
                    gte(aggregatedConsumerOptimizerMetrics.hourly_timestamp, from),
                    lte(aggregatedConsumerOptimizerMetrics.hourly_timestamp, to)
                ))
                .orderBy(aggregatedConsumerOptimizerMetrics.hourly_timestamp)
            , `ConsumerOptimizerMetricsByProviderResource::getAggregatedMetrics_${provider}_${from}_${to}`);

        const validMetrics: ConsumerOptimizerMetricsByProviderItem[] = [];

        for (const m of metrics) {
            if (m.latency_score_sum === null ||
                m.availability_score_sum === null ||
                m.sync_score_sum === null ||
                m.generic_score_sum === null ||
                m.node_error_rate_sum === null ||
                m.entry_index_sum === null ||
                m.metrics_count === null ||
                m.consumer === null ||
                m.consumer_hostname === null ||
                m.provider_stake === null ||
                m.chain === null) {
                logger.warn(`ConsumerOptimizerMetricsByProviderResource::getAggregatedMetrics_${provider}_${from}_${to} - Invalid metric(0): ${JSONStringify(m)}`);
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
                !IsMeaningfulText(m.chain)) {
                logger.warn(`ConsumerOptimizerMetricsByProviderResource::getAggregatedMetrics_${provider}_${from}_${to} - Invalid metric(1): ${JSONStringify(m)}`);
                continue;
            }

            validMetrics.push({
                chain: m.chain,
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
            });
        }

        return validMetrics;
    };
}

export const ConsumerOptimizerMetricsByProviderService = new ConsumerOptimizerMetricsByProviderResource();

