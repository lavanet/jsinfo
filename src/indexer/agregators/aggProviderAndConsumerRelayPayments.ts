// src/indexer/agregators/AggProviderAndConsumerRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { aggProviderRelayPayments } from './providerRelayPayments/aggProviderRelayPayments';
import { aggConsumerRelayPayments } from './consumerRelayPayments/aggConsumerRelayPayments';

export const AggProviderAndConsumerRelayPayments = async (db: PostgresJsDatabase) => {
    aggProviderRelayPayments(db);
    aggConsumerRelayPayments(db);
}

export const AggProviderAndConsumerRelayPaymentsSync = async (db: PostgresJsDatabase) => {
    await aggProviderRelayPayments(db);
    await aggConsumerRelayPayments(db);
}