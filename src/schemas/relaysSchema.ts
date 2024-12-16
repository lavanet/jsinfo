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

export const consumerOptimizerMetrics = pgTable('consumer_optimizer_metrics', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at', { withTimezone: true }),
  timestamp: timestamp('timestamp', { withTimezone: true }),
  consumer: text('consumer'),
  chain_id: text('chain_id'),
  latency_score: numeric('latency_score'),
  availability_score: numeric('availability_score'),
  sync_score: numeric('sync_score'),
  node_error_rate: numeric('node_error_rate'),
  provider: text('provider'),
  provider_stake: bigint('provider_stake', { mode: 'number' }),
  entry_index: integer('entry_index'),
  consumer_hostname: text('consumer_hostname'),
  generic_score: numeric('generic_score'),
  epoch: bigint('epoch', { mode: 'number' })
});
export type ConsumerOptimizerMetrics = typeof consumerOptimizerMetrics.$inferSelect
export type InsertConsumerOptimizerMetrics = typeof consumerOptimizerMetrics.$inferInsert