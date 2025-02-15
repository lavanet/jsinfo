// src/schemas/relaysSchema.ts

import { pgTable, text, serial, timestamp, varchar, numeric, bigint, integer } from 'drizzle-orm/pg-core';

export const lavaReportError = pgTable('lava_report_error', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at'),
  provider: varchar('provider', { length: 255 }),
  spec_id: varchar('spec_id', { length: 255 }),
  errors: text('errors'),
});
export type LavaReportError = typeof lavaReportError.$inferSelect
export type InsertLavaReportError = typeof lavaReportError.$inferInsert

// export const consumerOptimizerMetrics = pgTable('consumer_optimizer_metrics', {
//   id: serial('id').primaryKey(),
//   created_at: timestamp('created_at', { withTimezone: true }),
//   timestamp: timestamp('timestamp', { withTimezone: true }),
//   consumer: text('consumer'),
//   chain_id: text('chain_id'),
//   latency_score: numeric('latency_score'),
//   availability_score: numeric('availability_score'),
//   sync_score: numeric('sync_score'),
//   node_error_rate: numeric('node_error_rate'),
//   provider: text('provider'),
//   provider_stake: bigint('provider_stake', { mode: 'number' }),
//   entry_index: integer('entry_index'),
//   consumer_hostname: text('consumer_hostname'),
//   generic_score: numeric('generic_score'),
//   epoch: bigint('epoch', { mode: 'number' })
// });
// export type ConsumerOptimizerMetrics = typeof consumerOptimizerMetrics.$inferSelect
// export type InsertConsumerOptimizerMetrics = typeof consumerOptimizerMetrics.$inferInsert

export const aggregatedConsumerOptimizerMetrics = pgTable('aggregated_consumer_optimizer_metrics', {
  id: text('id').primaryKey().notNull(), // hour:::provider:::consumer:::hostname::chain
  serial_id: serial('serial_id'),

  hourly_timestamp: timestamp('hourly_timestamp', { withTimezone: true }).notNull(),
  provider: text('provider'),
  consumer: text('consumer'),
  consumer_hostname: text('consumer_hostname'),
  chain: text('chain'),

  metrics_count: integer('metrics_count').notNull(),

  sync_score_sum: numeric('sync_score_sum'),
  generic_score_sum: numeric('generic_score_sum'),
  availability_score_sum: numeric('availability_score_sum'),
  latency_score_sum: numeric('latency_score_sum'),
  node_error_rate_sum: numeric('node_error_rate_sum'),

  entry_index_sum: bigint('entry_index_sum', { mode: 'number' }),

  max_epoch: bigint('max_epoch', { mode: 'number' }),
  max_provider_stake: bigint('max_provider_stake', { mode: 'number' }),

  // New fields
  tier_sum: bigint('tier_sum', { mode: 'number' }),
  tier_chance_0_sum: numeric('tier_chance_0_sum'),
  tier_chance_1_sum: numeric('tier_chance_1_sum'),
  tier_chance_2_sum: numeric('tier_chance_2_sum'),
  tier_chance_3_sum: numeric('tier_chance_3_sum'),
  tier_metrics_count: integer('tier_metrics_count')
});

export type AggregatedConsumerOptimizerMetrics = typeof aggregatedConsumerOptimizerMetrics.$inferSelect
export type InsertAggregatedConsumerOptimizerMetrics = typeof aggregatedConsumerOptimizerMetrics.$inferInsert