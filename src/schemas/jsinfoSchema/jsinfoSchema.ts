// src/schemas/jsinfoSchema.ts

// Do not use 'drizzle-orm' date, it will cause bugs

import { sql } from 'drizzle-orm'
import { pgTable, index, text, integer, serial, bigint, real, timestamp, varchar, uniqueIndex } from 'drizzle-orm/pg-core';

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
  stake: bigint('stake', { mode: 'bigint' }),
  delegateLimit: bigint('delegate_limit', { mode: 'bigint' }),
  delegateTotal: bigint('delegate_total', { mode: 'bigint' }),
  delegateCommission: bigint('delegate_commission', { mode: 'bigint' }),

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
    providerStakesIdx: uniqueIndex("providerStakesIdx").on(
      table.provider,
      table.specId
    ),
  };
});

export type ProviderStake = typeof providerStakes.$inferSelect
export type InsertProviderStake = typeof providerStakes.$inferInsert

export const relayPayments = pgTable('relay_payments', {
  id: serial('id').primaryKey(),
  relays: bigint('relays', { mode: 'number' }),
  cu: bigint('cu', { mode: 'number' }),
  pay: bigint('pay', { mode: 'bigint' }),
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
    constumerIdx: index("consumer_idx").on(table.consumer),
    providerIdx: index("relay_payments_provider_idx").on(table.provider),
  };
});
export type RelayPayment = typeof relayPayments.$inferSelect
export type InsertRelayPayment = typeof relayPayments.$inferInsert

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
  ProviderTemporaryJailed,
  DelegatorClaimRewards,
  SetSubscriptionPolicyEvent,
  UnidentifiedEvent = 1000,
  ErrorEvent = 1001
}

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  eventType: integer('event_type'),

  t1: text('t1'),
  t2: text('t2'),
  t3: text('t3'),
  b1: bigint('b1', { mode: 'bigint' }),
  b2: bigint('b2', { mode: 'bigint' }),
  b3: bigint('b3', { mode: 'bigint' }),
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
  timestamp: timestamp("timestamp")

}, (table) => {
  return {
    providerIdx: index("events_provider_idx").on(table.provider),
  };
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
}, (table) => {
  return {
    providerIdx: index("conflict_votes_provider_idx").on(table.provider),
  };
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
}, (table) => {
  return {
    providerIdx: index("provider_reported_provider_idx").on(table.provider),
  };
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
}, (table) => {
  return {
    providerIdx: index("provider_latest_block_reports_provider_idx").on(table.provider),
  };
});

export type ProviderLatestBlockReports = typeof providerLatestBlockReports.$inferSelect;
export type InsertProviderLatestBlockReports = typeof providerLatestBlockReports.$inferInsert;

export const providerHealth = pgTable('provider_health2', {
  id: serial('id'),
  provider: text('provider').references(() => providers.address),
  timestamp: timestamp('timestamp').notNull(),
  guid: text('guid'),
  spec: varchar("spec", { length: 50 }).notNull(),
  geolocation: varchar("geolocation", { length: 10 }).default(sql`NULL`),
  interface: varchar("interface", { length: 50 }).default(sql`NULL`),
  status: varchar("status", { length: 10 }).notNull(), // 'healthy', 'frozen', 'unhealthy', 'jailed'
  data: varchar("data", { length: 1024 }).default(sql`NULL`),
}, (table) => {
  return {
    psmIdx: uniqueIndex("ph2idx").on(
      table.provider,
      table.spec,
      table.geolocation,
      table.interface,
      table.guid,
    ),
    providerIdx: index("provider_health2_provider_idx").on(table.provider),
    timestampIdx: index("provider_health2_timestamp_idx").on(table.timestamp),
  };
});

export type ProviderHealth = typeof providerHealth.$inferSelect;
export type InsertProviderHealth = typeof providerHealth.$inferInsert;

export const uniqueVisitors = pgTable('unique_visitors', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').notNull(),
  value: integer('value'),
});

export type UniqueVisitors = typeof uniqueVisitors.$inferSelect;
export type InsertUniqueVisitors = typeof uniqueVisitors.$inferInsert;

export const visitorMetrics = pgTable('visitor_metrics', {
  key: text('key').notNull().primaryKey(),
  value: text('value'),
}, (table) => {
  return {
    vmidx: index("vmidx").on(
      table.key,
    )
  };
});

export type VisitorMetrics = typeof visitorMetrics.$inferSelect;
export type InsertVisitorMetrics = typeof visitorMetrics.$inferInsert;

export const providerAccountInfo = pgTable('provider_accountinfo', {
  id: serial('id').primaryKey(),
  provider: text('provider').references(() => providers.address),
  timestamp: timestamp('timestamp').notNull(),
  data: text("data").default(sql`NULL`),
}, (table) => {
  return {
    providerIdx: index("provider_accountinfo_provider_idx").on(table.provider),
    timestampIdx: index("provider_accountinfo_timestamp_idx").on(table.timestamp),
  };
});

export type ProviderAccountInfo = typeof providerAccountInfo.$inferSelect;
export type InsertProviderAccountInfo = typeof providerAccountInfo.$inferInsert;

export const dualStackingDelegatorRewards = pgTable('dual_stacking_delegator_rewards', {
  id: serial('id').primaryKey(),
  provider: text('provider').notNull().references(() => providers.address),
  timestamp: timestamp('timestamp').notNull(),
  chainId: text('chain_id').notNull(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  denom: text('denom').notNull(),
}, (table) => {
  return {
    providerIdx: index("dual_stacking_delegator_rewards_provider_idx").on(table.provider),
  };
});

export type DualStackingDelegatorRewards = typeof dualStackingDelegatorRewards.$inferSelect;
export type InsertDualStackingDelegatorRewards = typeof dualStackingDelegatorRewards.$inferInsert;

export const providerSpecMoniker = pgTable('provider_spec_moniker', {
  id: serial('id').primaryKey(),
  provider: text('provider').notNull().references(() => providers.address),
  moniker: text('moniker'),
  specId: text('spec').references(() => specs.id),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp('updatedat').default(sql`CURRENT_TIMESTAMP(3)`),
}, (table) => {
  return {
    psmIdx: uniqueIndex("psmidx").on(
      table.provider,
      table.specId
    )
  };
});

export type ProviderSpecMoniker = typeof providerSpecMoniker.$inferSelect;
export type InsertProviderSpecMoniker = typeof providerSpecMoniker.$inferInsert;

export const consumerSubscriptionList = pgTable('consumer_subscription_list', {
  id: serial('id').primaryKey(),
  consumer: text('consumer').notNull().references(() => consumers.address),
  plan: text('plan'),
  fulltext: text('fulltext'),
  createdAt: timestamp("createdat").defaultNow().notNull(),
}, (table) => {
  return {
    cslIdx: index("cslidx").on(
      table.consumer,
    )
  };
});

export type ConsumerSubscriptionList = typeof consumerSubscriptionList.$inferSelect;
export type InsertConsumerSubscriptionList = typeof consumerSubscriptionList.$inferInsert;

export const supply = pgTable('supply', {
  key: text('key').notNull().primaryKey(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  timestamp: timestamp('timestamp', { mode: "date" }).notNull(),
}, (table) => {
  return {
    supplyIdx: index("supplyIdx").on(
      table.key,
    )
  };
});

export type Supply = typeof supply.$inferSelect;
export type InsertSupply = typeof supply.$inferInsert;