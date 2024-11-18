import { sql } from 'drizzle-orm';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { logger } from '@jsinfo/utils/logger';
import { GetUtcNow } from '@jsinfo/utils/date';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';

class SpecAndConsumerResource extends RedisResourceBase<{ specs: string[], consumers: string[] }, {}> {
    protected readonly redisKey = 'spec-and-consumer-cache';
    protected ttlSeconds = 120; // 2 minutes

    protected async fetchFromDb(db: PostgresJsDatabase): Promise<{ specs: string[], consumers: string[] }> {
        const [specs, consumers] = await Promise.all([
            this.fetchSpecTable(db),
            this.fetchConsumerTable(db)
        ]);

        return { specs, consumers };
    }

    private async fetchSpecTable(db: PostgresJsDatabase): Promise<string[]> {
        // First try to get from key-value store
        const result = await db
            .select()
            .from(JsinfoSchema.keyValueStore)
            .where(eq(JsinfoSchema.keyValueStore.key, 'specs'))
            .limit(1);

        if (result.length > 0 && result[0].value) {
            return result[0].value.split(',');
        }

        // Fallback to old method if key-value store is empty
        logger.warn('No specs found in key-value store, falling back to provider stakes query');
        const threeMonthsAgo = GetUtcNow();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // Get specs from provider stakes and health
        const [stakeSpecs, healthSpecs] = await Promise.all([
            db.select({ specId: JsinfoSchema.providerStakes.specId })
                .from(JsinfoSchema.providerStakes)
                .groupBy(JsinfoSchema.providerStakes.specId),

            db.select({ specId: JsinfoSchema.providerHealth.spec })
                .from(JsinfoSchema.providerHealth)
                .where(sql`${JsinfoSchema.providerHealth.timestamp} >= ${threeMonthsAgo}`)
                .groupBy(JsinfoSchema.providerHealth.spec)
        ]);

        const allSpecs = [...stakeSpecs, ...healthSpecs]
            .map(spec => spec.specId!.toUpperCase());

        return Array.from(new Set(allSpecs));
    }

    private async fetchConsumerTable(db: PostgresJsDatabase): Promise<string[]> {
        const results = await db
            .select({ consumer: JsinfoSchema.consumerSubscriptionList.consumer })
            .from(JsinfoSchema.consumerSubscriptionList)
            .groupBy(JsinfoSchema.consumerSubscriptionList.consumer);

        return results.map(c => c.consumer.toLowerCase());
    }

    public async IsValidSpec(specId: string): Promise<boolean> {
        const data = await this.fetchAndPickDb();
        return data?.specs.includes(specId.toUpperCase()) ?? false;
    }

    public async IsValidConsumer(consumer: string): Promise<boolean> {
        const data = await this.fetchAndPickDb();
        return data?.consumers.includes(consumer.toLowerCase()) ?? false;
    }

    public async GetAllSpecs(): Promise<string[]> {
        const data = await this.fetchAndPickDb();
        return data?.specs ?? [];
    }

    public async GetAllConsumers(): Promise<string[]> {
        const data = await this.fetchAndPickDb();
        return data?.consumers ?? [];
    }
}

export const SpecAndConsumerService = new SpecAndConsumerResource();
