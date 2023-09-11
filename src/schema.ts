import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const blocks = sqliteTable('blocks', {
  height: integer('height').unique(),
});
export type Block = typeof blocks.$inferSelect
export type InsertBlock = typeof blocks.$inferInsert

export const providers = sqliteTable('providers', {
  address: text('address').unique(),
  moniker: text('moniker'),
});
export type Provider = typeof providers.$inferSelect
export type InsertProvider = typeof providers.$inferInsert

export const specs = sqliteTable('specs', {
  id: text('id').unique(),
});
export type Spec = typeof specs.$inferSelect
export type InsertSpec = typeof specs.$inferInsert

export const providerStakes = sqliteTable('provider_stakes', {
  id: integer('id').primaryKey(),
  appliedHeight: integer('applied_height'),
  provider: text('provider').references(() => providers.address),
  specId: text('spec_id').references(() => specs.id),
  blockId: integer('block_id').references(() => blocks.height),
});
export type ProviderStake = typeof providerStakes.$inferSelect
export type InsertProviderStake = typeof providerStakes.$inferInsert

export const relayPayments = sqliteTable('relay_payments', {
  id: integer('id').primaryKey(),
  relays: integer('relays'),
  cu: integer('cu'),
  pay: integer('pay'),
  qosSync: real('qos_sync'),  
  qosAvailability: real('qos_availability'),  
  qosLatency: real('qos_latency'),  
  provider: text('provider').references(() => providers.address),
  specId: text('spec_id').references(() => specs.id),
  blockId: integer('block_id').references(() => blocks.height),
});
export type RelayPayment = typeof relayPayments.$inferSelect
export type InsertRelayPayment = typeof relayPayments.$inferInsert

export const events = sqliteTable('events', {
  id: integer('id').primaryKey(),
  eventType: integer('event_type'),
  
  provider: text('provider').references(() => providers.address),
  blockId: integer('block_id').references(() => blocks.height),
});
export type Event = typeof events.$inferSelect
export type InsertEvent = typeof events.$inferInsert

