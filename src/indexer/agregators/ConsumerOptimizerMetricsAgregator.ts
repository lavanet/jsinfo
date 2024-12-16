import { and, sql, desc } from 'drizzle-orm';

import {
    ConsumerOptimizerMetrics as RelaysDb_ConsumerOptimizerMetrics,
    consumerOptimizerMetrics as RelaysDb_consumerOptimizerMetrics
} from '@jsinfo/schemas/relaysSchema';

import {
    consumerOptimizerMetricsAgg as JsinfoDb_consumerOptimizerMetricsAgg,
    InsertConsumerOptimizerMetricsAgg as JsinfoDb_InsertConsumerOptimizerMetricsAgg,
    consumerOptimizerMetricsAggTimes as JsinfoDb_consumerOptimizerMetricsAggTimes
} from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';

import { queryRelays, queryJsinfo } from '@jsinfo/utils/db';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';

type AggregatedMetricTempData = {
    timestamp: Date;
    consumer: string;
    chain_id: string;
    provider: string;
    consumer_hostname: string;
    latency_scores: number[];
    availability_scores: number[];
    sync_scores: number[];
    node_error_rates: number[];
    entry_indices: number[];
    generic_scores: number[];
    provider_stake: number;
    epoch: number;
}

export class ConsumerOptimizerMetricsAgregator {
    private static async RelaysDb_GetLowestCreatedAt(): Promise<Date> {
        const lowest = await queryRelays(
            db => db.select({
                min: sql<Date>`min(${RelaysDb_consumerOptimizerMetrics.created_at})`
            })
                .from(RelaysDb_consumerOptimizerMetrics),
            'ConsumerOptimizerMetricsAgregator::RelaysDb_GetLowestCreatedAt'
        );

        if (!lowest[0]?.min) {
            throw new Error('No metrics found in RelaysDb');
        }

        return lowest[0].min;
    }

    private static async JsinfoDb_RelaysDb_GetLastAggTime(): Promise<{ from: Date, to: Date }> {
        const lastAgg = await queryJsinfo(
            async (db) => {
                const result = await db.select()
                    .from(JsinfoDb_consumerOptimizerMetricsAggTimes)
                    .orderBy(desc(JsinfoDb_consumerOptimizerMetricsAggTimes.created_at))
                    .limit(1);
                return result;
            },
            'ConsumerOptimizerMetricsAgregator::JsinfoDb_RelaysDb_GetLastAggTime'
        );

        let from: Date;
        if (lastAgg.length === 0 || lastAgg[0].last_to === null) {
            from = await this.RelaysDb_GetLowestCreatedAt();
        } else {
            from = lastAgg[0].last_to;
        }

        from = new Date(from.setMinutes(0, 0, 0));
        const to = new Date(from.getTime() + 60 * 60 * 1000);

        return { from, to };
    }

    private static async RelaysDb_FetchMetrics(from: Date, to: Date): Promise<RelaysDb_ConsumerOptimizerMetrics[]> {
        return await queryRelays(
            db => db.select()
                .from(RelaysDb_consumerOptimizerMetrics)
                .where(and(
                    sql`${RelaysDb_consumerOptimizerMetrics.timestamp} >= ${from}`,
                    sql`${RelaysDb_consumerOptimizerMetrics.timestamp} < ${to}`
                )),
            'ConsumerOptimizerMetricsAgregator::RelaysDb_FetchMetrics'
        );
    }

    private static AggregateMetrics(metrics: RelaysDb_ConsumerOptimizerMetrics[]): JsinfoDb_InsertConsumerOptimizerMetricsAgg[] {
        const aggregated = new Map<string, AggregatedMetricTempData>();

        for (const metric of metrics) {
            if (!IsMeaningfulText(metric.consumer) || !IsMeaningfulText(metric.chain_id) || !IsMeaningfulText(metric.provider) || !IsMeaningfulText(metric.consumer_hostname)) {
                continue;
            }
            if (!metric.consumer || !metric.chain_id || !metric.provider || !metric.consumer_hostname) {
                continue;
            }
            if (!IsMeaningfulText(metric.timestamp + "") || !metric.timestamp) {
                continue;
            }

            const hourKey = new Date(metric.timestamp).setMinutes(0, 0, 0);
            const key = `${hourKey}_${metric.consumer}_${metric.chain_id}_${metric.provider}_${metric.consumer_hostname}`;

            let agg = aggregated.get(key);
            if (!agg) {
                agg = {
                    timestamp: new Date(hourKey),
                    consumer: metric.consumer,
                    chain_id: metric.chain_id,
                    provider: metric.provider,
                    consumer_hostname: metric.consumer_hostname,
                    latency_scores: [],
                    availability_scores: [],
                    sync_scores: [],
                    node_error_rates: [],
                    entry_indices: [],
                    generic_scores: [],
                    provider_stake: metric.provider_stake || 0,
                    epoch: metric.epoch || 0
                };
                aggregated.set(key, agg);
            }

            if (Number(metric.latency_score) !== 0) agg.latency_scores.push(Number(metric.latency_score));
            if (Number(metric.availability_score) !== 0) agg.availability_scores.push(Number(metric.availability_score));
            if (Number(metric.sync_score) !== 0) agg.sync_scores.push(Number(metric.sync_score));
            if (Number(metric.node_error_rate) !== 0) agg.node_error_rates.push(Number(metric.node_error_rate));
            if (Number(metric.entry_index) !== 0) agg.entry_indices.push(Number(metric.entry_index));
            if (Number(metric.generic_score) !== 0) agg.generic_scores.push(Number(metric.generic_score));

            if (metric.provider_stake) {
                agg.provider_stake = Math.max(agg.provider_stake, metric.provider_stake);
            }
            if (metric.epoch) {
                agg.epoch = Math.max(agg.epoch, metric.epoch);
            }
        }

        // In Drizzle ORM, the numeric type from Postgres is actually mapped to string in TypeScript by default.
        // This is because JavaScript / TypeScript cannot safely handle the full precision of Postgres' numeric type without potential loss of precision.

        return Array.from(aggregated.values()).map(({
            timestamp, consumer, chain_id, provider, consumer_hostname,
            latency_scores, availability_scores, sync_scores,
            node_error_rates, entry_indices, generic_scores,
            provider_stake, epoch
        }) => ({
            created_at: new Date(),
            timestamp,
            consumer,
            chain_id,
            provider,
            consumer_hostname,
            latency_score: String(avg(latency_scores)),
            availability_score: String(avg(availability_scores)),
            sync_score: String(avg(sync_scores)),
            node_error_rate: String(avg(node_error_rates)),
            entry_index: String(avg(entry_indices)),
            generic_score: String(avg(generic_scores)),
            provider_stake,
            epoch
        }));
    }

    private static async JsinfoDb_SaveAggregatedMetrics(metrics: JsinfoDb_InsertConsumerOptimizerMetricsAgg[]) {
        const CHUNK_SIZE = 1000;
        let totalProcessed = 0;

        for (let i = 0; i < metrics.length; i += CHUNK_SIZE) {
            const chunk = metrics.slice(i, i + CHUNK_SIZE);
            await queryJsinfo(
                async (db) => {
                    return db.insert(JsinfoDb_consumerOptimizerMetricsAgg)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: [
                                JsinfoDb_consumerOptimizerMetricsAgg.timestamp,
                                JsinfoDb_consumerOptimizerMetricsAgg.consumer,
                                JsinfoDb_consumerOptimizerMetricsAgg.chain_id,
                                JsinfoDb_consumerOptimizerMetricsAgg.provider,
                                JsinfoDb_consumerOptimizerMetricsAgg.consumer_hostname
                            ],
                            set: {
                                latency_score: sql`excluded.latency_score`,
                                availability_score: sql`excluded.availability_score`,
                                sync_score: sql`excluded.sync_score`,
                                node_error_rate: sql`excluded.node_error_rate`,
                                entry_index: sql`excluded.entry_index`,
                                generic_score: sql`excluded.generic_score`,
                                provider_stake: sql`excluded.provider_stake`,
                                epoch: sql`excluded.epoch`,
                                created_at: sql`excluded.created_at`
                            }
                        });
                },
                'ConsumerOptimizerMetricsAgregator::JsinfoDb_SaveAggregatedMetrics'
            );

            totalProcessed += chunk.length;
            logger.info(`[ConsumerOptimizerMetricsAgregator] Saved chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(metrics.length / CHUNK_SIZE)} (${totalProcessed}/${metrics.length} records)`);
        }
    }

    private static async JsinfoDb_UpdateAggregationTimes(from: Date, to: Date) {
        await queryJsinfo(
            async (db) => {
                return db.insert(JsinfoDb_consumerOptimizerMetricsAggTimes)
                    .values({
                        last_from: from,
                        last_to: to,
                        created_at: new Date()
                    });
            },
            'ConsumerOptimizerMetricsAgregator::JsinfoDb_UpdateAggregationTimes'
        );
    }

    private static currentAggregation: Promise<void> | null = null;

    public static async AggregateAll() {
        // Return existing promise if aggregation is running
        if (this.currentAggregation) {
            logger.info('[ConsumerOptimizerMetricsAgregator] Aggregation already running, reusing existing promise');
            return this.currentAggregation;
        }

        this.currentAggregation = (async () => {
            try {
                while (true) {
                    const { from, to } = await this.JsinfoDb_RelaysDb_GetLastAggTime();
                    const metrics = await this.RelaysDb_FetchMetrics(from, to);

                    if (metrics.length === 0) {
                        logger.info('[ConsumerOptimizerMetricsAgregator] No metrics to aggregate, waiting 10 minutes');
                        await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
                        continue;
                    }

                    logger.info(`[ConsumerOptimizerMetricsAgregator] Aggregating ${metrics.length} metrics from ${from} to ${to}`);
                    const aggregatedMetrics = this.AggregateMetrics(metrics);
                    await this.JsinfoDb_SaveAggregatedMetrics(aggregatedMetrics);
                    await this.JsinfoDb_UpdateAggregationTimes(from, to);

                    logger.info(`[ConsumerOptimizerMetricsAgregator] Aggregated into ${aggregatedMetrics.length} rows`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                logger.error('[ConsumerOptimizerMetricsAgregator] Fatal error during aggregation', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    error_json: JSONStringify(error),
                    timestamp: new Date().toISOString()
                });
                throw error;
            } finally {
                this.currentAggregation = null;
            }
        })();

        return this.currentAggregation;
    }
}

function avg(numbers: number[]): number {
    return numbers.length ? numbers.reduce((a, b) => a + b) / numbers.length : 0;
}

export async function ConsumerOptimizerMetricsAgregator_Aggregate() {
    await ConsumerOptimizerMetricsAgregator.AggregateAll();
}

if (require.main === module) {
    ConsumerOptimizerMetricsAgregator_Aggregate();
}

