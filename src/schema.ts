import { pgTable, index, text, integer, serial, bigint, real, primaryKey, timestamp, pgMaterializedView } from 'drizzle-orm/pg-core';

export const blocks = pgTable('blocks', {
  height: integer('height').unique(),
  datetime: timestamp('datetime', { mode: "date" }),
});
export type Block = typeof blocks.$inferSelect
export type InsertBlock = typeof blocks.$inferInsert

export const consumers = pgTable('consumers', {
  address: text('address').unique(),
});
export type Consumer = typeof consumers.$inferSelect
export type InsertConsumer = typeof consumers.$inferInsert

export const plans = pgTable('plans', {
  id: text('id').unique(),
  desc: text('desc'),
  price: bigint('pay', { mode: 'number' }),
});
export type Plan = typeof plans.$inferSelect
export type InsertPlan = typeof plans.$inferInsert

export const providers = pgTable('providers', {
  address: text('address').unique(),
  moniker: text('moniker'),
});
export type Provider = typeof providers.$inferSelect
export type InsertProvider = typeof providers.$inferInsert

export const specs = pgTable('specs', {
  id: text('id').unique(),
});
export type Spec = typeof specs.$inferSelect
export type InsertSpec = typeof specs.$inferInsert

export const providerStakes = pgTable('provider_stakes', {
  stake: bigint('stake', { mode: 'number' }),
  appliedHeight: integer('applied_height'),

  provider: text('provider').references(() => providers.address),
  specId: text('spec_id').references(() => specs.id),
  blockId: integer('block_id').references(() => blocks.height),
}, (table) => {
  return {
    pk: primaryKey(table.provider, table.specId),
  };
});
export type ProviderStake = typeof providerStakes.$inferSelect
export type InsertProviderStake = typeof providerStakes.$inferInsert

export const relayPayments = pgTable('relay_payments', {
  id: serial('id').primaryKey(),
  relays: bigint('relays', { mode: 'number' }),
  cu: bigint('cu', { mode: 'number' }),
  pay: bigint('pay', { mode: 'number' }),

  qosSync: real('qos_sync'),
  qosAvailability: real('qos_availability'),
  qosLatency: real('qos_latency'),

  qosSyncExc: real('qos_sync_exc'),
  qosAvailabilityExc: real('qos_availability_exc'),
  qosLatencyExc: real('qos_latency_exc'),

  provider: text('provider').references(() => providers.address),
  specId: text('spec_id').references(() => specs.id),
  blockId: integer('block_id').references(() => blocks.height),
  consumer: text('consumer').references(() => consumers.address),
}, (table) => {
  return {
    nameIdx: index("name_idx").on(table.specId),
  };
});
export type RelayPayment = typeof relayPayments.$inferSelect
export type InsertRelayPayment = typeof relayPayments.$inferInsert
export const relayPaymentsAggView = pgMaterializedView('relay_payments_agg_view', {
    provider: text('provider'),
    date: timestamp('date', { mode: "date" }),
    chainId: text('spec_id'),
    cuSum: bigint('cusum', { mode: 'number' }),
    relaySum: bigint('relaysum', { mode: 'number' }),
    rewardSum: bigint('rewardsum', { mode: 'number' }),
    qosSyncAvg: bigint('qosSyncAvg', { mode: 'number' }),
    qosAvailabilityAvg: bigint('qosAvailabilityAvg', { mode: 'number' }),
    qosLatencyAvg: bigint('qosLatencyAvg', { mode: 'number' }),
    qosSyncExcAvg: bigint('qosSyncExcAvg', { mode: 'number' }),
    qosAvailabilityExcAvg: bigint('qosAvailabilityExcAvg', { mode: 'number' }),
    qosLatencyExcAv: bigint('qosLatencyExcAv', { mode: 'number' }),
  }).existing()

export enum LavaProviderEventType {
  StakeNewProvider = 1,
  StakeUpdateProvider,
  ProviderUnstakeCommit,
  FreezeProvider,
  UnfreezeProvider,
}

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  eventType: integer('event_type'),

  provider: text('provider').references(() => providers.address),
  blockId: integer('block_id').references(() => blocks.height),
});
export type Event = typeof events.$inferSelect
export type InsertEvent = typeof events.$inferInsert

export const conflictResponses = pgTable('conflict_responses', {
  id: serial('id').primaryKey(),

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

export const conflictVotes = pgTable('conflict_votes', {
  id: serial('id').primaryKey(),
  voteId: text('vote_id'),

  blockId: integer('block_id').references(() => blocks.height),
  provider: text('provider').references(() => providers.address),

});
export type ConflictVote = typeof conflictVotes.$inferSelect
export type InsertConflictVote = typeof conflictVotes.$inferInsert

export const subscriptionBuys = pgTable('subscription_buys', {
  blockId: integer('block_id').references(() => blocks.height),
  consumer: text('consumer').references(() => consumers.address),
  duration: integer('number'),
  plan: text('plan').references(() => plans.id),
});
export type SubscriptionBuy = typeof subscriptionBuys.$inferSelect
export type InsertSubscriptionBuy = typeof subscriptionBuys.$inferInsert

export const providerReported = pgTable('provider_reported', {
  provider: text('provider').references(() => providers.address),
  blockId: integer('block_id').references(() => blocks.height),
  
  cu: bigint('cu', { mode: 'number' }),
  disconnections: integer('disconnections'),
  epoch: integer('epoch'),
  errors: integer('errors'),
  project: text('project'),
  datetime: timestamp('datetime', { mode: "date" }),
  totalComplaintEpoch: integer('total_complaint_this_epoch'),
});
export type ProviderReported = typeof providerReported.$inferSelect
export type InsertProviderReported = typeof providerReported.$inferInsert
