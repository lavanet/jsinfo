import { pgTable, text, doublePrecision, bigint, uniqueIndex, timestamp } from 'drizzle-orm/pg-core';

export const activeProviders = pgTable(
    "active_providers",
    {
        provider: text("provider"),
        lastActive: timestamp("last_active", { mode: "string" }), // MAX(bucket_15min) as last_active
        totalRelays: bigint("total_relays", { mode: "number" }), // COALESCE(SUM(relaysum), 0) as total_relays
        totalServices: text("totalservices"), // CONCAT(SUM(CASE WHEN ps.status = 1 THEN 1 ELSE 0 END), ' / ', COUNT(ps.spec_id)) as totalservices
        totalStake: bigint("totalstake", { mode: "number" }), // COALESCE(SUM(ps.stake + LEAST(ps.delegate_total, ps.delegate_limit)), 0) AS totalstake
        rewardSum: doublePrecision("rewardsum"), // COALESCE(SUM(rewardsum), 0) as rewardsum
        moniker: text("moniker"), // (SELECT MAX(moniker) FROM provider_spec_moniker WHERE provider = ps.provider) as moniker
    },
    (table) => {
        return {
            activeProvidersIdx: uniqueIndex("activeProvidersIdx").on(table.provider), // CREATE UNIQUE INDEX ON active_providers (provider)
        };
    }
);

export type ActiveProviders = typeof activeProviders.$inferSelect;
export type InsertActiveProviders = typeof activeProviders.$inferInsert;

export const activeAndInactiveProviders = pgTable(
    "active_and_inactive_providers",
    {
        provider: text("provider"),
        lastActive: timestamp("last_active", { mode: "string" }), // MAX(bucket_15min) as last_active
        totalRelays: bigint("total_relays", { mode: "number" }), // COALESCE(SUM(relaysum), 0) as total_relays
        totalServices: text("totalservices"), // CONCAT(SUM(CASE WHEN ps.status = 1 THEN 1 ELSE 0 END), ' / ', COUNT(ps.spec_id)) as totalservices
        totalStake: bigint("totalstake", { mode: "number" }), // COALESCE(SUM(ps.stake + LEAST(ps.delegate_total, ps.delegate_limit)), 0) AS totalstake
        rewardSum: doublePrecision("rewardsum"), // COALESCE(SUM(rewardsum), 0) as rewardsum
        moniker: text("moniker"), // (SELECT MAX(moniker) FROM provider_spec_moniker WHERE provider = ps.provider) as moniker
    },
    (table) => {
        return {
            activeAndInactiveProvidersIdx: uniqueIndex("activeAndInactiveProvidersIdx").on(table.provider), // CREATE UNIQUE INDEX ON active_and_inactive_providers (provider)
        };
    }
);

export type ActiveAndInactiveProviders = typeof activeAndInactiveProviders.$inferSelect;
export type InsertActiveAndInactiveProviders = typeof activeAndInactiveProviders.$inferInsert;
