// src/schemas/jsinfo_schema.ts

// Do not use 'drizzle-orm' date, it will cause bugs

import { sql } from 'drizzle-orm'
import { pgTable, index, text, integer, serial, bigint, real, uniqueIndex, primaryKey, timestamp, doublePrecision, varchar } from 'drizzle-orm/pg-core';

export const blocks = pgTable('blocks', {
  height: integer('height').unique(),
  datetime: timestamp('datetime', { mode: "date" }),
});
export type Block = typeof blocks.$inferSelect
export type InsertBlock = typeof blocks.$inferInsert

export const txs = pgTable('txs', {
  hash: text('tx_hash').unique(),
  blockId: integer('block_id').references(() => blocks.height),
});
export type Tx = typeof txs.$inferSelect
export type InsertTx = typeof txs.$inferInsert

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

export enum LavaProviderStakeStatus {
  Active = 1,
  Frozen,
  Unstaking,
  Inactive,
}
export const providerStakes = pgTable('provider_stakes', {
  stake: bigint('stake', { mode: 'number' }),
  appliedHeight: integer('applied_height'),
  geolocation: integer('geolocation'),
  addons: text('addons'),
  extensions: text('extensions'),
  status: integer('status'), // LavaProviderStakeStatus

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
  datetime: timestamp('datetime', { mode: "date" }),

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
  tx: text('tx').references(() => txs.hash),
}, (table) => {
  return {
    nameIdx: index("name_idx").on(table.specId),
    tsIdx: index("ts_idx").on(table.datetime),
  };
});
export type RelayPayment = typeof relayPayments.$inferSelect
export type InsertRelayPayment = typeof relayPayments.$inferInsert

export const aggHourlyrelayPayments = pgTable('agg_hourly_relay_payments', {
  provider: text('provider').references(() => providers.address),
  datehour: timestamp('datehour', { mode: "string" }),
  specId: text('spec_id').references(() => specs.id),
  cuSum: bigint('cusum', { mode: 'number' }),
  relaySum: bigint('relaysum', { mode: 'number' }),
  rewardSum: bigint('rewardsum', { mode: 'number' }),
  qosSyncAvg: doublePrecision('qossyncavg'),
  qosAvailabilityAvg: doublePrecision('qosavailabilityavg'),
  qosLatencyAvg: doublePrecision('qoslatencyavg'),
  qosSyncExcAvg: doublePrecision('qossyncexcavg'),
  qosAvailabilityExcAvg: doublePrecision('qosavailabilityexcavg'),
  qosLatencyExcAvg: doublePrecision('qoslatencyexcavg'),
}, (table) => {
  return {
    aggHourlyIdx: uniqueIndex("aggHourlyIdx").on(table.datehour, table.specId, table.provider),
  };
});
export type AggHorulyRelayPayment = typeof aggHourlyrelayPayments.$inferSelect
export type InsertAggHourlyRelayPayment = typeof aggHourlyrelayPayments.$inferInsert

export enum LavaProviderEventType {
  StakeNewProvider = 1,
  StakeUpdateProvider,
  ProviderUnstakeCommit,
  FreezeProvider,
  UnfreezeProvider,
  AddKeyToProject,
  AddProjectToSubscription,
  ConflictDetectionReceived,
  DelKeyFromProject,
  DelProjectToSubscription,
  ProviderJailed,
  VoteGotReveal,
  VoteRevealStarted,
  DetectionVoteResolved,
  DetectionVoteUnresolved,
  DelegateToProvider,
  ExpireSubscription,
  FreezeFromUnbond,
  UbnondFromProvider,
  UnstakeFromUnbound,
  RedelegateBetweenProviders,
  ProviderBonusRewards,
  ValidtorSlash,
  IPRPCPoolEmission,
  DistributionPoolsRefill,
  UnidentifiedEvent = 1000,
  ErrorEvent = 1001
}

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  eventType: integer('event_type'),

  t1: text('t1'),
  t2: text('t2'),
  t3: text('t3'),
  b1: bigint('b1', { mode: 'number' }),
  b2: bigint('b2', { mode: 'number' }),
  b3: bigint('b3', { mode: 'number' }),
  i1: integer('i1'),
  i2: integer('i2'),
  i3: integer('i3'),
  r1: real('r1'),
  r2: real('r2'),
  r3: real('r3'),

  provider: text('provider').references(() => providers.address),
  consumer: text('consumer').references(() => consumers.address),
  blockId: integer('block_id').references(() => blocks.height),
  tx: text('tx').references(() => txs.hash),

  fulltext: text('fulltext'),
});
export type Event = typeof events.$inferSelect
export type InsertEvent = typeof events.$inferInsert

export const conflictResponses = pgTable('conflict_responses', {
  id: serial('id').primaryKey(),

  blockId: integer('block_id').references(() => blocks.height),
  consumer: text('consumer').references(() => consumers.address),
  specId: text('spec_id').references(() => specs.id),
  tx: text('tx').references(() => txs.hash),

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
  tx: text('tx').references(() => txs.hash),
});
export type ConflictVote = typeof conflictVotes.$inferSelect
export type InsertConflictVote = typeof conflictVotes.$inferInsert

export const subscriptionBuys = pgTable('subscription_buys', {
  blockId: integer('block_id').references(() => blocks.height),
  consumer: text('consumer').references(() => consumers.address),
  duration: integer('number'),
  plan: text('plan').references(() => plans.id),
  tx: text('tx').references(() => txs.hash),
});
export type SubscriptionBuy = typeof subscriptionBuys.$inferSelect
export type InsertSubscriptionBuy = typeof subscriptionBuys.$inferInsert

export const providerReported = pgTable('provider_reported', {
  id: serial('id').primaryKey(),

  provider: text('provider').references(() => providers.address),
  blockId: integer('block_id').references(() => blocks.height),

  cu: bigint('cu', { mode: 'number' }),
  disconnections: integer('disconnections'),
  epoch: integer('epoch'),
  errors: integer('errors'),
  project: text('project'),
  datetime: timestamp('datetime', { mode: "date" }),
  totalComplaintEpoch: integer('total_complaint_this_epoch'),
  tx: text('tx').references(() => txs.hash),
});
export type ProviderReported = typeof providerReported.$inferSelect
export type InsertProviderReported = typeof providerReported.$inferInsert

export const providerLatestBlockReports = pgTable('provider_latest_block_reports', {
  id: serial('id').primaryKey(),
  provider: text('provider').references(() => providers.address),
  blockId: integer('block_id').references(() => blocks.height),
  tx: text('tx').references(() => txs.hash),
  timestamp: timestamp('timestamp').notNull(),
  chainId: text('chain_id').notNull(),
  chainBlockHeight: bigint('chain_block_height', { mode: 'number' }),
});

export type ProviderLatestBlockReports = typeof providerLatestBlockReports.$inferSelect;
export type InsertProviderLatestBlockReports = typeof providerLatestBlockReports.$inferInsert;

export const providerHealthHourly = pgTable('provider_health_hourly', {
  id: serial('id').primaryKey(),
  provider: text('provider').references(() => providers.address),
  timestamp: timestamp('timestamp').notNull(),
  spec: varchar("spec", { length: 255 }).notNull(),
  interface: varchar("interface", { length: 255 }).default(sql`NULL`),
  status: varchar("status", { length: 10 }).notNull(), // 'healthy', 'frozen', 'unhealthy'
  message: varchar("message", { length: 255 }).default(sql`NULL`),
  block: integer('block').default(sql`NULL`),
  blocksaway: integer('blocksaway').default(sql`NULL`),
  latency: integer('latency').default(sql`NULL`),
});

export type ProviderHealthHourly = typeof providerHealthHourly.$inferSelect;
export type InsertProviderHealthHourly = typeof providerHealthHourly.$inferInsert;

export const dualStackingDelegatorRewards = pgTable('dual_stacking_delegator_rewards', {
  id: serial('id').primaryKey(),
  provider: text('provider').notNull().references(() => providers.address),
  timestamp: timestamp('timestamp').notNull(),
  chainId: text('chain_id').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  denom: text('denom').notNull(),
});

export type DualStackingDelegatorRewards = typeof dualStackingDelegatorRewards.$inferSelect;
export type InsertDualStackingDelegatorRewards = typeof dualStackingDelegatorRewards.$inferInsert;

