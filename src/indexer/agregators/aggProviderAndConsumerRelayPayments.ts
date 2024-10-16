// src/indexer/agregators/AggProviderAndConsumerRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { logger } from '../../utils/utils';

export const AggProviderAndConsumerRelayPayments = async (db: PostgresJsDatabase) => {
    refreshMaterializedViews(db);
}

export const AggProviderAndConsumerRelayPaymentsSync = async (db: PostgresJsDatabase) => {
    await refreshMaterializedViews(db);
}

async function refreshMaterializedViews(db: PostgresJsDatabase) {
    try {
        logger.info('Starting to refresh materialized views');

        // Refresh continuous aggregates
        await db.execute(sql`CALL refresh_continuous_aggregate('agg_15min_provider_relay_payments', NULL, NULL)`);
        await db.execute(sql`CALL refresh_continuous_aggregate('agg_15min_consumer_relay_payments', NULL, NULL)`);

        // Refresh regular materialized views
        await db.execute(sql`REFRESH MATERIALIZED VIEW agg_total_provider_relay_payments`);
        await db.execute(sql`REFRESH MATERIALIZED VIEW agg_total_consumer_relay_payments`);

        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY active_providers;`);

        await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY active_and_inactive_providers`);
        logger.info('Finished refreshing materialized views');
    } catch (error) {
        logger.error('Error refreshing materialized views:', error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}