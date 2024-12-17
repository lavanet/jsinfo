// src/redis/resources/provider/consumerOptimizerMetrics.ts

import { ConsumerOptimizerMetricsAgg, consumerOptimizerMetricsAgg } from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { and, eq, SQL, gt, lt } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IsMeaningfulText, JSONStringify } from '@jsinfo/utils/fmt';
import { ProviderMonikerService } from '../global/ProviderMonikerSpecResource';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface ConsumerOptimizerMetricsResourceFilterParams {
    provider: string;
    from?: Date;
    to?: Date;
}

export interface ConsumerOptimizerMetricsResourceResponse {
    filters: {
        provider?: string;
        from?: Date;
        to?: Date;
    };
    metrics: ConsumerOptimizerMetricsAgg[];
    error?: string;
}

export class ConsumerOptimizerMetricsResource extends RedisResourceBase<ConsumerOptimizerMetricsResourceResponse, ConsumerOptimizerMetricsResourceFilterParams> {
    protected readonly redisKey = 'consumer_optimizer_metrics';
    protected readonly cacheExpirySeconds = 300;

    protected async fetchFromSource(args: ConsumerOptimizerMetricsResourceFilterParams): Promise<ConsumerOptimizerMetricsResourceResponse> {
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

        const conditions: SQL<unknown>[] = [];
        conditions.push(gt(consumerOptimizerMetricsAgg.timestamp, from));
        conditions.push(lt(consumerOptimizerMetricsAgg.timestamp, to));
        conditions.push(eq(consumerOptimizerMetricsAgg.provider, provider));

        const metrics = await queryJsinfo(
            db => db.select().from(consumerOptimizerMetricsAgg)
                .where(and(...conditions))
                .orderBy(consumerOptimizerMetricsAgg.timestamp).limit(200),
            `ConsumerOptimizerMetricsResource::fetchFromSource_${JSONStringify(args)}`
        );

        return {
            filters: { ...args, from, to },
            metrics
        };
    }
}

export const ConsumerOptimizerMetricsService = new ConsumerOptimizerMetricsResource();

