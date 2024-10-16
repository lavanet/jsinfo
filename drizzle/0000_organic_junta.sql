--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocks" (
	"height" integer,
	"datetime" timestamp,
	CONSTRAINT "blocks_height_unique" UNIQUE("height")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_id" integer,
	"consumer" text,
	"spec_id" text,
	"tx" text,
	"vote_id" text,
	"request_block" integer,
	"vote_deadline" integer,
	"api_interface" text,
	"api_URL" text,
	"connection_type" text,
	"request_data" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"vote_id" text,
	"block_id" integer,
	"provider" text,
	"tx" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumer_subscription_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"consumer" text NOT NULL,
	"plan" text,
	"fulltext" text,
	"createdat" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dual_stacking_delegator_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"chain_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"denom" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" integer,
	"t1" text,
	"t2" text,
	"t3" text,
	"b1" bigint,
	"b2" bigint,
	"b3" bigint,
	"i1" integer,
	"i2" integer,
	"i3" integer,
	"r1" real,
	"r2" real,
	"r3" real,
	"provider" text,
	"consumer" text,
	"block_id" integer,
	"tx" text,
	"fulltext" text,
	"timestamp" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_health" (
	"id" serial NOT NULL,
	"provider" text,
	"timestamp" timestamp NOT NULL,
	"guid" text,
	"spec" varchar(50) NOT NULL,
	"geolocation" varchar(10) DEFAULT NULL,
	"interface" varchar(50) DEFAULT NULL,
	"status" varchar(10) NOT NULL,
	"data" varchar(1024) DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_latest_block_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text,
	"block_id" integer,
	"tx" text,
	"timestamp" timestamp NOT NULL,
	"chain_id" text NOT NULL,
	"chain_block_height" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_reported" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text,
	"block_id" integer,
	"cu" bigint,
	"disconnections" integer,
	"epoch" integer,
	"errors" integer,
	"project" text,
	"datetime" timestamp,
	"total_complaint_this_epoch" integer,
	"tx" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_spec_moniker" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"moniker" text,
	"spec" text,
	"createdat" timestamp DEFAULT now() NOT NULL,
	"updatedat" timestamp DEFAULT CURRENT_TIMESTAMP(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_stakes" (
	"stake" bigint,
	"delegate_limit" bigint,
	"delegate_total" bigint,
	"delegate_commission" bigint,
	"applied_height" integer,
	"geolocation" integer,
	"addons" text,
	"extensions" text,
	"status" integer,
	"provider" text,
	"spec_id" text,
	"block_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relay_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"relays" bigint,
	"cu" bigint,
	"pay" bigint,
	"datetime" timestamp,
	"qos_sync" real,
	"qos_availability" real,
	"qos_latency" real,
	"qos_sync_exc" real,
	"qos_availability_exc" real,
	"qos_latency_exc" real,
	"provider" text,
	"spec_id" text,
	"block_id" integer,
	"consumer" text,
	"tx" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_buys" (
	"block_id" integer,
	"consumer" text,
	"number" integer,
	"plan" text,
	"tx" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supply" (
	"key" text PRIMARY KEY NOT NULL,
	"amount" text NOT NULL,
	"timestamp" timestamp NOT NULL
);

--> statement-breakpoint
ment-breakpoint
CREATE INDEX IF NOT EXISTS "conflict_votes_provider_idx" ON "conflict_votes" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cslidx" ON "consumer_subscription_list" ("consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dual_stacking_delegator_rewards_provider_idx" ON "dual_stacking_delegator_rewards" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_provider_idx" ON "events" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ph2idx" ON "provider_health" ("provider","spec","geolocation","interface","guid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_provider_idx" ON "provider_health" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_timestamp_idx" ON "provider_health" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_latest_block_reports_provider_idx" ON "provider_latest_block_reports" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_reported_provider_idx" ON "provider_reported" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "psmidx" ON "provider_spec_moniker" ("provider","spec");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "providerStakesIdx" ON "provider_stakes" ("provider","spec_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "name_idx" ON "relay_payments" ("spec_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ts_idx" ON "relay_payments" ("datetime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_idx" ON "relay_payments" ("consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_payments_provider_idx" ON "relay_payments" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplyIdx" ON "supply" ("key");