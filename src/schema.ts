import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const blocks = sqliteTable('blocks', {
  height: integer('height').unique(),
  datetime: integer('datetime', { mode: 'timestamp' }),
});
export type Block = typeof blocks.$inferSelect
export type InsertBlock = typeof blocks.$inferInsert

export const consumers = sqliteTable('consumers', {
  address: text('address').unique(),
});
export type Consumer = typeof consumers.$inferSelect
export type InsertConsumer = typeof consumers.$inferInsert

export const plans = sqliteTable('plans', {
  id: text('id').unique(),
  desc: text('desc'),
  price: integer('pay'),
});
export type Plan = typeof plans.$inferSelect
export type InsertPlan = typeof plans.$inferInsert

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
  stake: integer('stake'),
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
  consumer: text('consumer').references(() => consumers.address),
});
export type RelayPayment = typeof relayPayments.$inferSelect
export type InsertRelayPayment = typeof relayPayments.$inferInsert

export enum LavaProviderEventType {
  StakeNewProvider = 1,
  StakeUpdateProvider,
  ProviderUnstakeCommit,
  FreezeProvider,
  UnfreezeProvider,
}

export const events = sqliteTable('events', {
  id: integer('id').primaryKey(),
  eventType: integer('event_type'),
  
  provider: text('provider').references(() => providers.address),
  blockId: integer('block_id').references(() => blocks.height),
});
export type Event = typeof events.$inferSelect
export type InsertEvent = typeof events.$inferInsert

export const conflictResponses = sqliteTable('conflict_responses', {
  id: integer('id').primaryKey(),

  blockId: integer('block_id').references(() => blocks.height),
  consumer: text('consumer').references(() => consumers.address),
  specId: text('spec_id').references(() => specs.id),
  
  voteId: text('vote_id'),
  requestBlock: integer('request_block'),
  voteDeadline: integer('vote_deadline'),
  apiInterface: text('api_interface'),
  apiURL: text('api_URL'),
  connectionType: text('connection_type'),
  requestData: text('request_data'),
});
export type ConflictResponse = typeof conflictResponses.$inferSelect
export type InsertConflictResponse = typeof conflictResponses.$inferInsert

export const conflictVotes = sqliteTable('conflict_votes', {
  id: integer('id').primaryKey(),
  voteId: text('vote_id'),
  
  blockId: integer('block_id').references(() => blocks.height),
  provider: text('provider').references(() => providers.address),
  
});
export type ConflictVote = typeof conflictVotes.$inferSelect
export type InsertConflictVote = typeof conflictVotes.$inferInsert

export const subscriptionBuys = sqliteTable('subscription_buys', {
  blockId: integer('block_id').references(() => blocks.height),
  consumer: text('consumer').references(() => consumers.address),
  duration: integer('number'),
  plan: text('plan').references(() => plans.id),
});
export type SubscriptionBuy = typeof subscriptionBuys.$inferSelect
export type InsertSubscriptionBuy = typeof subscriptionBuys.$inferInsert
