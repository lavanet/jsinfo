// src/schemas/jsinfoSchema.ts

// Do not use 'drizzle-orm' date, it will cause bugs

import { sql } from 'drizzle-orm'
import { pgTable, index, text, integer, serial, bigint, real, timestamp, varchar, uniqueIndex, primaryKey, jsonb, numeric } from 'drizzle-orm/pg-core';

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

  provider: text('provider'),
  specId: text('spec_id'),
  blockId: integer('block_id'),
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

  provider: text('provider'),
  specId: text('spec_id'),
  blockId: integer('block_id'),
  consumer: text('consumer'),
  tx: text('tx'),
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

  provider: text('provider'),
  consumer: text('consumer'),
  blockId: integer('block_id'),
  tx: text('tx'),

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

  blockId: integer('block_id'),
  consumer: text('consumer'),
  specId: text('spec_id'),
  tx: text('tx'),

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

  blockId: integer('block_id'),
  provider: text('provider'),
  tx: text('tx'),
}, (table) => {
  return {
    providerIdx: index("conflict_votes_provider_idx").on(table.provider),
  };
});

export type ConflictVote = typeof conflictVotes.$inferSelect
export type InsertConflictVote = typeof conflictVotes.$inferInsert

export const subscriptionBuys = pgTable('subscription_buys', {
  blockId: integer('block_id'),
  consumer: text('consumer'),
  duration: integer('number'),
  plan: text('plan'),
  tx: text('tx'),
}, (table) => {
  return {
    consumerIdx: index("subscription_buys_consumer_idx").on(table.consumer),
  };
});
export type SubscriptionBuy = typeof subscriptionBuys.$inferSelect
export type InsertSubscriptionBuy = typeof subscriptionBuys.$inferInsert

export const providerReported = pgTable('provider_reported', {
  id: serial('id').primaryKey(),

  provider: text('provider'),
  blockId: integer('block_id'),

  cu: bigint('cu', { mode: 'number' }),
  disconnections: integer('disconnections'),
  epoch: integer('epoch'),
  errors: integer('errors'),
  project: text('project'),
  chainId: text('chain_id'),
  datetime: timestamp('datetime', { mode: "date" }),
  totalComplaintEpoch: integer('total_complaint_this_epoch'),
  tx: text('tx'),
}, (table) => {
  return {
    providerIdx: index("provider_reported_provider_idx").on(table.provider),
  };
});
export type ProviderReported = typeof providerReported.$inferSelect
export type InsertProviderReported = typeof providerReported.$inferInsert

export const providerLatestBlockReports = pgTable('provider_latest_block_reports', {
  id: serial('id').primaryKey(),
  provider: text('provider'),
  blockId: integer('block_id'),
  tx: text('tx'),
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
  provider: text('provider'),
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

export const providerSpecMoniker = pgTable('provider_spec_moniker', {
  provider: text('provider').notNull(),
  moniker: text('moniker'),
  spec: text('spec'),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.provider, table.spec] })
  };
});

export type ProviderSpecMoniker = typeof providerSpecMoniker.$inferSelect;
export type InsertProviderSpecMoniker = typeof providerSpecMoniker.$inferInsert;

export const consumerSubscriptionList = pgTable('consumer_subscription_list', {
  id: serial('id').primaryKey(),
  consumer: text('consumer').notNull(),
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
  amount: text('amount').notNull(),
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

export const blocks = pgTable('blocks', {
  height: integer('height').unique(),
  datetime: timestamp('datetime', { mode: "date" }),
});
export type Block = typeof blocks.$inferSelect
export type InsertBlock = typeof blocks.$inferInsert


export const keyValueStore = pgTable('key_value_store', {
  key: text('key').notNull().primaryKey(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: "date" }).defaultNow().notNull(),
}, (table) => {
  return {
    keyIdx: index("key_value_store_key_idx").on(table.key),
  };
});

export type KeyValueStore = typeof keyValueStore.$inferSelect;
export type InsertKeyValueStore = typeof keyValueStore.$inferInsert;

export const apr = pgTable('apr', {
  key: text('key').notNull().primaryKey(),
  value: real('value').notNull(),
  timestamp: timestamp('timestamp', { mode: "date" }).defaultNow().notNull(),
}, (table) => {
  return {
    aprIdx: index("aprIdx").on(
      table.key,
    )
  };
});

export type Apr = typeof apr.$inferSelect;
export type InsertApr = typeof apr.$inferInsert;

// Add new table for delegator rewards
export const delegatorRewards = pgTable('delegator_rewards', {
  delegator: text('delegator').primaryKey(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export type DelegatorRewards = typeof delegatorRewards.$inferSelect;
export type InsertDelegatorRewards = typeof delegatorRewards.$inferInsert;

export const specTrackedInfo = pgTable('spec_tracked_info', {
  provider: text('provider').notNull(),
  chain_id: text('chain_id').notNull(),
  iprpc_cu: text('iprpc_cu').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.provider, table.chain_id] }),
  };
});

export type SpecTrackedInfo = typeof specTrackedInfo.$inferSelect;
export type InsertSpecTrackedInfo = typeof specTrackedInfo.$inferInsert;

export const aprPerProvider = pgTable('apr_per_provider', {
  provider: text('provider').notNull(),
  type: text('type').notNull(),
  value: text('value').notNull(),
  timestamp: timestamp('timestamp', { mode: "date" }).defaultNow().notNull(),
  estimatedRewards: jsonb('estimated_rewards'),
}, (table) => {
  return {
    appidx: primaryKey({ columns: [table.provider, table.type] }),
  };
});

export type AprPerProvider = typeof aprPerProvider.$inferSelect;
export type InsertAprPerProvider = typeof aprPerProvider.$inferInsert;

export const aprFullInfo = pgTable('apr_full_info', {
  address: text('address').notNull(),
  value: text('value').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  type: text('type').notNull(),
}, (table) => {
  return {
    appidx: primaryKey({ columns: [table.address, table.type] }),
  };
});

export type AprFullInfo = typeof aprFullInfo.$inferSelect;
export type InsertAprFullInfo = typeof aprFullInfo.$inferInsert;

export const consumerOptimizerMetricsAgg = pgTable('consumer_optimizer_metrics_agg', {
  id: serial('id'),
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
  entry_index: numeric('entry_index'),
  consumer_hostname: text('consumer_hostname'),
  generic_score: numeric('generic_score'),
  epoch: bigint('epoch', { mode: 'number' })
}, (table) => {
  return {
    consumerIdx: index("consumer_optimizer_metrics_agg_consumer_idx").on(table.consumer),
    hostnameIdx: index("consumer_optimizer_metrics_agg_hostname_idx").on(table.consumer_hostname),
    chainIdx: index("consumer_optimizer_metrics_agg_chain_idx").on(table.chain_id),
    providerIdx: index("consumer_optimizer_metrics_agg_provider_idx").on(table.provider),
    uniqueConstraint: uniqueIndex('consumer_optimizer_metrics_agg_unique_idx')
      .on(table.timestamp, table.consumer, table.chain_id,
        table.provider, table.consumer_hostname)
  };
});
export type ConsumerOptimizerMetricsAgg = typeof consumerOptimizerMetricsAgg.$inferSelect
export type InsertConsumerOptimizerMetricsAgg = typeof consumerOptimizerMetricsAgg.$inferInsert

export const consumerOptimizerMetricsAggTimes = pgTable('consumer_optimizer_metrics_agg_times', {
  id: serial('id').primaryKey(),
  last_from: timestamp('last_from', { withTimezone: true }),
  last_to: timestamp('last_to', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true })
});

export type ConsumerOptimizerMetricsAggTimes = typeof consumerOptimizerMetricsAggTimes.$inferSelect
export type InsertConsumerOptimizerMetricsAggTimes = typeof consumerOptimizerMetricsAggTimes.$inferInsert