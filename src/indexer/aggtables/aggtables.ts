// src/indexer/agregators/AggProviderAndConsumerRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { logger } from '@jsinfo/utils/logger';
import { queryJsinfo } from '@jsinfo/utils/db';

export const AggProviderAndConsumerRelayPayments = async () => {
    refreshMaterializedViews();
}

async function refreshMaterializedViews() {
    try {
        logger.info('Starting to refresh materialized views');

        // Refresh continuous aggregates
        const measureExecutionTime = async (description: string, sqlCommand: string) => {
            const start = Date.now();
            await queryJsinfo(
                async (db: PostgresJsDatabase) => db.execute(sql`${sql.raw(sqlCommand)}`),
                `refreshMaterializedViews_${description}`
            );
            const end = Date.now();
            const duration = end - start;
            logger.info(`${description} took ${duration}ms`);
        };

        // Refresh continuous aggregates
        await measureExecutionTime(
            "Refreshing agg_15min_provider_relay_payments",
            "CALL refresh_continuous_aggregate('agg_15min_provider_relay_payments', NULL, NULL)"
        );

        await measureExecutionTime(
            "Refreshing agg_15min_consumer_relay_payments",
            "CALL refresh_continuous_aggregate('agg_15min_consumer_relay_payments', NULL, NULL)"
        );

        // Refresh regular materialized views
        await measureExecutionTime(
            "Refreshing agg_total_provider_relay_payments",
            "REFRESH MATERIALIZED VIEW CONCURRENTLY agg_total_provider_relay_payments"
        );
        await measureExecutionTime(
            "Refreshing agg_total_consumer_relay_payments",
            "REFRESH MATERIALIZED VIEW CONCURRENTLY agg_total_consumer_relay_payments"
        );

        await measureExecutionTime(
            "Refreshing active_providers",
            "REFRESH MATERIALIZED VIEW CONCURRENTLY active_providers"
        );

        await measureExecutionTime(
            "Refreshing active_and_inactive_providers",
            "REFRESH MATERIALIZED VIEW CONCURRENTLY active_and_inactive_providers"
        );

        logger.info('Finished refreshing materialized views');
    } catch (error) {
        logger.error('Error refreshing materialized views:', error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}