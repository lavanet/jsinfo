// ./src/jsinfo/src/schemas/jsinfoSchema/providerRelayPaymentsAgregation.ts

import * as jsinfoSchema from './jsinfoSchema';
import { pgTable, text, bigint, uniqueIndex, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

export const aggHourlyRelayPayments = pgTable(
  "agg_hourly_relay_payments",
  {
    provider: text("provider").references(() => jsinfoSchema.providers.address),
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
      aggHourlyIdx: uniqueIndex("aggHourlyIdx").on(
        table.datehour,
        table.specId,
        table.provider
      ),
    };
  }
);
export type AggHorulyRelayPayment = typeof aggHourlyRelayPayments.$inferSelect;
export type InsertAggHourlyRelayPayment =
  typeof aggHourlyRelayPayments.$inferInsert;

export const aggDailyRelayPayments = pgTable(
  "agg_daily_relay_payments",
  {
    provider: text("provider").references(() => jsinfoSchema.providers.address),
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
      aggDailyIdx: uniqueIndex("aggHourlyIdx").on(
        table.datehour,
        table.specId,
        table.provider
      ),
    };
  }
);
export type AggDailyRelayPayment = typeof aggDailyRelayPayments.$inferSelect;
export type InsertAggDailyRelayPayment =
  typeof aggDailyRelayPayments.$inferInsert;

export const aggAllTimeRelayPayments = pgTable(
  "agg_alltime_relay_payments",
  {
    provider: text("provider").references(() => jsinfoSchema.providers.address),
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
      aggAllTimeIdx: uniqueIndex("aggAllTimeIdx").on(
        table.datehour,
        table.specId,
        table.provider
      ),
    };
  }
);
export type AggAllTimeRelayPayment =
  typeof aggAllTimeRelayPayments.$inferSelect;
export type InsertAggAllTimeRelayPayment =
  typeof aggAllTimeRelayPayments.$inferInsert;
