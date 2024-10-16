// src/schemas/jsinfoSchema/consumerRelayPayments.ts

import {
  pgTable,
  text,
  bigint,
  timestamp,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const agg15MinConsumerRelayTsPayments = pgTable(
  "agg_15min_consumer_relay_payments",
  {
    bucket15min: timestamp("bucket_15min", { mode: "string" }), // time_bucket('15 minutes', datetime) AS bucket_15min
    consumer: text("consumer"), // consumer
    specId: text("spec_id"), // spec_id
    cuSum: bigint("cusum", { mode: "number" }), // SUM(cu) AS cusum
    relaySum: bigint("relaysum", { mode: "number" }), // SUM(relays) AS relaysum
    rewardSum: bigint("rewardsum", { mode: "number" }), // SUM(pay) AS rewardsum
    qosSyncAvg: doublePrecision("qossyncavg"), // SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0)
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"), // SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0)
    qosLatencyAvg: doublePrecision("qoslatencyavg"), // SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0)
  },
);
export type Agg15MinConsumerRelayTsPayment =
  typeof agg15MinConsumerRelayTsPayments.$inferSelect;
export type InsertAgg15MinConsumerRelayTsPayment =
  typeof agg15MinConsumerRelayTsPayments.$inferInsert;

export const aggTotalConsumerRelayPayments = pgTable(
  "agg_total_consumer_relay_payments",
  {
    consumer: text("consumer"), // consumer
    specId: text("spec_id"), // spec_id
    cuSum: bigint("total_cusum", { mode: "number" }), // SUM(cu) AS total_cusum
    relaySum: bigint("total_relaysum", { mode: "number" }), // SUM(relays) AS total_relaysum
    rewardSum: bigint("total_rewardsum", { mode: "number" }), // SUM(pay) AS total_rewardsum
    qosSyncAvg: doublePrecision("qossyncavg"), // SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0)
    qosSyncExcAvg: doublePrecision("qossyncexcavg"), // SUM(qos_sync_exc * relays) / NULLIF(SUM(CASE WHEN qos_sync_exc IS NOT NULL THEN relays ELSE 0 END), 0)
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"), // SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0)
    qosLatencyAvg: doublePrecision("qoslatencyavg"), // SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0)
  }
);
export type AggTotalConsumerRelayPayment =
  typeof aggTotalConsumerRelayPayments.$inferSelect;
export type InsertAggTotalConsumerRelayPayment =
  typeof aggTotalConsumerRelayPayments.$inferInsert;

