// src/redis/resources/provider/consumerOptimizerMetrics.ts

import { ConsumerOptimizerMetricsAgg, consumerOptimizerMetricsAgg } from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { and, eq, SQL, gt, lt } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
import { ProviderMonikerService } from '../global/ProviderMonikerSpecResource';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface ConsumerOptimizerMetricsFilterParams {
    consumer?: string;
    chain_id?: string;
    provider?: string;
    to?: Date;
    from?: Date;
}

export interface ConsumerOptimizerMetricsResponse {
    filters: {
        consumer?: string;
        chain_id?: string;
        provider?: string;
        from?: Date;
        to?: Date;
    };
    possibleChainIds: string[];
    possibleConsumers: string[];
    metrics: ConsumerOptimizerMetricsAgg[];
    error?: string;
}

export class ConsumerOptimizerMetricsResource extends RedisResourceBase<ConsumerOptimizerMetricsResponse, ConsumerOptimizerMetricsFilterParams> {
    protected readonly redisKey = 'consumer_optimizer_metrics';
    protected readonly cacheExpirySeconds = 300;

    protected async fetchFromSource(args?: ConsumerOptimizerMetricsFilterParams): Promise<ConsumerOptimizerMetricsResponse> {
        if (!args?.consumer && !args?.chain_id && !args?.provider) {
            return {
                filters: { from: undefined, to: undefined },
                possibleChainIds: [],
                possibleConsumers: [],
                metrics: [],
                error: 'At least one filter (consumer, chain_id, or provider) must be specified'
            };
        }

        const provider = args?.provider;

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
                possibleChainIds: [],
                possibleConsumers: [],
                metrics: [],
                error: 'Invalid provider (empty)'
            };
        }

        const isValidProvider = await ProviderMonikerService.IsValidProvider(provider);
        if (!isValidProvider) {
            return {
                filters: { ...args, from, to },
                possibleChainIds: [],
                possibleConsumers: [],
                metrics: [],
                error: 'Invalid provider (not found)'
            };
        }

        const options = await ConsumerOptimizerMetricsOptionsService.fetch({ provider: provider });
        if (!options) {
            return {
                filters: { ...args, from, to },
                possibleChainIds: [],
                possibleConsumers: [],
                metrics: [],
                error: 'Invalid provider (no metrics found)'
            };
        }

        if (args?.consumer && !options.possibleConsumers.includes(args.consumer)) {
            return {
                filters: { ...args, from, to },
                possibleChainIds: options.possibleChainIds,
                possibleConsumers: options.possibleConsumers,
                metrics: [],
                error: 'Invalid consumer'
            };
        }

        if (args?.chain_id && !options.possibleChainIds.includes(args.chain_id)) {
            return {
                filters: { ...args, from, to },
                possibleChainIds: options.possibleChainIds,
                possibleConsumers: options.possibleConsumers,
                metrics: [],
                error: 'Invalid chain_id'
            };
        }

        const conditions: SQL<unknown>[] = [];
        conditions.push(gt(consumerOptimizerMetricsAgg.timestamp, from));
        conditions.push(lt(consumerOptimizerMetricsAgg.timestamp, to));

        if (args?.consumer) {
            conditions.push(eq(consumerOptimizerMetricsAgg.consumer, args.consumer));
        }
        if (args?.chain_id) {
            conditions.push(eq(consumerOptimizerMetricsAgg.chain_id, args.chain_id));
        }
        if (args?.provider) {
            conditions.push(eq(consumerOptimizerMetricsAgg.provider, args.provider));
        }

        const metrics = await queryJsinfo(
            db => db.select().from(consumerOptimizerMetricsAgg)
                .where(and(...conditions))
                .orderBy(consumerOptimizerMetricsAgg.timestamp).limit(200),
            `ConsumerOptimizerMetricsResource::fetchFromSource_${JSONStringify(args)}`
        );

        const possibleChainIds = options.possibleChainIds;
        const possibleConsumers = options.possibleConsumers;

        return {
            filters: { ...args, from, to },
            possibleChainIds,
            possibleConsumers,
            metrics
        };
    }
}

export const ConsumerOptimizerMetricsService = new ConsumerOptimizerMetricsResource();

export interface ConsumerOptimizerMetricsOptionsResponse {
    possibleChainIds: string[];
    possibleConsumers: string[];
}

export interface ConsumerOptimizerMetricsOptionsFilterParams {
    provider: string;
}

class ConsumerOptimizerMetricsOptionsResource extends RedisResourceBase<ConsumerOptimizerMetricsOptionsResponse, ConsumerOptimizerMetricsOptionsFilterParams> {
    protected readonly redisKey = 'consumer_optimizer_metrics_options';
    protected readonly cacheExpirySeconds = 300;

    protected async fetchFromSource(args?: ConsumerOptimizerMetricsOptionsFilterParams): Promise<ConsumerOptimizerMetricsOptionsResponse> {
        const provider = args?.provider;
        if (!provider || !IsMeaningfulText(provider)) {
            throw new Error('Provider filter is required. args:' + JSONStringify(args).substring(0, 100));
        }

        const isValidProvider = await ProviderMonikerService.IsValidProvider(provider);
        if (!isValidProvider) {
            throw new Error('Provider does not exist');
        }

        const metrics = await queryJsinfo(
            db => db.select({
                chain_id: consumerOptimizerMetricsAgg.chain_id,
                consumer: consumerOptimizerMetricsAgg.consumer
            })
                .from(consumerOptimizerMetricsAgg)
                .where(eq(consumerOptimizerMetricsAgg.provider, provider)),
            'all_metrics'
        );

        const possibleChainIds = [...new Set(metrics.map(m => m.chain_id))].filter((id): id is string => id !== null);
        const possibleConsumers = [...new Set(metrics.map(m => m.consumer))].filter((c): c is string => c !== null);

        return { possibleChainIds, possibleConsumers };
    }
}

export const ConsumerOptimizerMetricsOptionsService = new ConsumerOptimizerMetricsOptionsResource();
