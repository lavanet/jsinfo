// src/indexer/agregators/aggProviderAndConsumerRelayPayments.ts

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { aggProviderRelayPayments } from './providerRelayPayments/aggProviderRelayPayments';
import { aggConsumerRelayPayments } from './consumerRelayPayments/aggConsumerRelayPayments';

export const aggProviderAndConsumerRelayPayments = async (db: PostgresJsDatabase) => {
    aggProviderRelayPayments(db);
    aggConsumerRelayPayments(db);
}

export const aggProviderAndConsumerRelayPaymentsSync = async (db: PostgresJsDatabase) => {
    await aggProviderRelayPayments(db);
    await aggConsumerRelayPayments(db);
}