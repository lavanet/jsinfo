// src/schemas/jsinfoSchema/providerRelayPayments.ts

import { pgTable, text, bigint, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

export const agg15MinProviderRelayTsPayments = pgTable(
  "agg_15min_provider_relay_payments",
  {
    bucket15min: timestamp("bucket_15min", { mode: "string" }), // time_bucket('15 minutes', datetime)
    provider: text("provider"),
    specId: text("spec_id"),
    cuSum: bigint("cusum", { mode: "number" }), // SUM(cu)
    relaySum: bigint("relaysum", { mode: "number" }), // SUM(relays)
    rewardSum: bigint("rewardsum", { mode: "number" }), // SUM(pay)
    qosSyncAvg: doublePrecision("qossyncavg"), // SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0)
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"), // SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0)
    qosLatencyAvg: doublePrecision("qoslatencyavg"), // SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0)
  }
);

export type Agg15MinProviderRelayTsPayment = typeof agg15MinProviderRelayTsPayments.$inferSelect;
export type InsertAgg15MinProviderRelayTsPayment =
  typeof agg15MinProviderRelayTsPayments.$inferInsert;

export const aggTotalProviderRelayMvPayments = pgTable(
  "agg_total_provider_relay_payments",
  {
    provider: text("provider"), // provider
    specId: text("spec_id"), // spec_id
    cuSum: bigint("total_cusum", { mode: "number" }), // SUM(cu) AS total_cusum
    relaySum: bigint("total_relaysum", { mode: "number" }), // SUM(relays) AS total_relaysum
    rewardSum: bigint("total_rewardsum", { mode: "number" }), // SUM(pay) AS total_rewardsum
    qosSyncAvg: doublePrecision("qossyncavg"), // SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0)
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"), // SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0)
    qosLatencyAvg: doublePrecision("qoslatencyavg"), // SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0)
  }
);
export type AggTotalProviderRelayMvPayments =
  typeof aggTotalProviderRelayMvPayments.$inferSelect;
export type InsertAggTotalProviderRelayMvPayments =
  typeof aggTotalProviderRelayMvPayments.$inferInsert;
