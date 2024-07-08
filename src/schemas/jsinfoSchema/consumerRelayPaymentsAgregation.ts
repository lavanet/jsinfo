// src/jsinfo/src/schemas/jsinfoSchemaConsumerRelayPaymentsAgregation.ts

import * as jsinfoSchema from "./jsinfoSchema";
import {
  pgTable,
  text,
  bigint,
  uniqueIndex,
  timestamp,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const aggConsumerHourlyRelayPayments = pgTable(
  "agg_consumer_hourly_relay_payments",
  {
    consumer: text("consumer").references(() => jsinfoSchema.consumers.address),
    datehour: timestamp("datehour", { mode: "string" }),
    specId: text("spec_id").references(() => jsinfoSchema.specs.id),
    cuSum: bigint("cusum", { mode: "number" }),
    relaySum: bigint("relaysum", { mode: "number" }),
    rewardSum: bigint("rewardsum", { mode: "number" }),
    qosSyncAvg: doublePrecision("qossyncavg"),
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"),
    qosLatencyAvg: doublePrecision("qoslatencyavg"),
    qosSyncExcAvg: doublePrecision("qossyncexcavg"),
    qosAvailabilityExcAvg: doublePrecision("qosavailabilityexcavg"),
    qosLatencyExcAvg: doublePrecision("qoslatencyexcavg"),
  },
  (table) => {
    return {
      aggConsumerHourlyIdx: uniqueIndex("aggConsumerHourlyIdx").on(
        table.datehour,
        table.specId,
        table.consumer
      ),
    };
  }
);
export type AggConsumerHorulyRelayPayment =
  typeof aggConsumerHourlyRelayPayments.$inferSelect;
export type InsertAggConsumerHorulyRelayPayment =
  typeof aggConsumerHourlyRelayPayments.$inferInsert;

export const aggConsumerDailyRelayPayments = pgTable(
  "agg_consumer_daily_relay_payments",
  {
    consumer: text("consumer").references(() => jsinfoSchema.consumers.address),
    dateday: timestamp("dateday", { mode: "string" }),
    specId: text("spec_id").references(() => jsinfoSchema.specs.id),
    cuSum: bigint("cusum", { mode: "number" }),
    relaySum: bigint("relaysum", { mode: "number" }),
    rewardSum: bigint("rewardsum", { mode: "number" }),
    qosSyncAvg: doublePrecision("qossyncavg"),
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"),
    qosLatencyAvg: doublePrecision("qoslatencyavg"),
    qosSyncExcAvg: doublePrecision("qossyncexcavg"),
    qosAvailabilityExcAvg: doublePrecision("qosavailabilityexcavg"),
    qosLatencyExcAvg: doublePrecision("qoslatencyexcavg"),
  },
  (table) => {
    return {
      aggConsumerDailyIdx: uniqueIndex("aggConsumerDailyIdx").on(
        table.dateday,
        table.specId,
        table.consumer
      ),
    };
  }
);
export type AggConsumerDailyRelayPayment =
  typeof aggConsumerDailyRelayPayments.$inferSelect;
export type InsertAggConsumerDailyRelayPayment =
  typeof aggConsumerDailyRelayPayments.$inferInsert;

export const aggConsumerAllTimeRelayPayments = pgTable(
  "agg_consumer_alltime_relay_payments",
  {
    consumer: text("consumer").references(() => jsinfoSchema.consumers.address),
    specId: text("spec_id").references(() => jsinfoSchema.specs.id),
    cuSum: bigint("cusum", { mode: "number" }),
    relaySum: bigint("relaysum", { mode: "number" }),
    rewardSum: bigint("rewardsum", { mode: "number" }),
    qosSyncAvg: doublePrecision("qossyncavg"),
    qosAvailabilityAvg: doublePrecision("qosavailabilityavg"),
    qosLatencyAvg: doublePrecision("qoslatencyavg"),
    qosSyncExcAvg: doublePrecision("qossyncexcavg"),
    qosAvailabilityExcAvg: doublePrecision("qosavailabilityexcavg"),
    qosLatencyExcAvg: doublePrecision("qoslatencyexcavg"),
  },
  (table) => {
    return {
      aggConsumerAllTimeIdx: uniqueIndex("aggConsumerAllTimeIdx").on(
        table.specId,
        table.consumer
      ),
    };
  }
);
export type AggConsumerAllTimeRelayPayment =
  typeof aggConsumerAllTimeRelayPayments.$inferSelect;
export type InsertAggConsumerAllTimeRelayPayment =
  typeof aggConsumerAllTimeRelayPayments.$inferInsert;
