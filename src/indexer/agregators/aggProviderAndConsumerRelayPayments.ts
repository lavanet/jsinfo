// src/indexer/agregators/AggProviderAndConsumerRelayPayments.ts

import { aggProviderRelayPayments } from './providerRelayPayments/aggProviderRelayPayments';
import { aggConsumerRelayPayments } from './consumerRelayPayments/aggConsumerRelayPayments';

export const AggProviderAndConsumerRelayPayments = async () => {
    aggProviderRelayPayments();
    aggConsumerRelayPayments();
}

export const AggProviderAndConsumerRelayPaymentsSync = async () => {
    await aggProviderRelayPayments();
    await aggConsumerRelayPayments();
}