-- Create role if not exists
DO $$ 
BEGIN
  CREATE ROLE jsinfo LOGIN PASSWORD 'secret';
  EXCEPTION WHEN DUPLICATE_OBJECT THEN
  RAISE NOTICE 'Role jsinfo already exists';
END
$$;

-- Create databases if they don't exist
SELECT 'CREATE DATABASE relays OWNER jsinfo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'relays')\gexec

SELECT 'CREATE DATABASE jsinfo OWNER jsinfo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'jsinfo')\gexec

-- Grant privileges
ALTER ROLE jsinfo WITH LOGIN CREATEDB SUPERUSER;
GRANT ALL PRIVILEGES ON DATABASE relays TO jsinfo;
GRANT ALL PRIVILEGES ON DATABASE jsinfo TO jsinfo;

-- Connect to jsinfo database and create schema
\c jsinfo jsinfo;

CREATE TABLE IF NOT EXISTS "agg_consumer_alltime_relay_payments" (
	"consumer" text,
	"spec_id" text,
	"cusum" bigint,
	"relaysum" bigint,
	"rewardsum" bigint,
	"qossyncavg" double precision,
	"qosavailabilityavg" double precision,
	"qoslatencyavg" double precision,
	"qossyncexcavg" double precision,
	"qosavailabilityexcavg" double precision,
	"qoslatencyexcavg" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agg_consumer_daily_relay_payments" (
	"consumer" text,
	"dateday" timestamp,
	"spec_id" text,
	"cusum" bigint,
	"relaysum" bigint,
	"rewardsum" bigint,
	"qossyncavg" double precision,
	"qosavailabilityavg" double precision,
	"qoslatencyavg" double precision,
	"qossyncexcavg" double precision,
	"qosavailabilityexcavg" double precision,
	"qoslatencyexcavg" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agg_consumer_hourly_relay_payments" (
	"consumer" text,
	"datehour" timestamp,
	"spec_id" text,
	"cusum" bigint,
	"relaysum" bigint,
	"rewardsum" bigint,
	"qossyncavg" double precision,
	"qosavailabilityavg" double precision,
	"qoslatencyavg" double precision,
	"qossyncexcavg" double precision,
	"qosavailabilityexcavg" double precision,
	"qoslatencyexcavg" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apr" (
	"key" text PRIMARY KEY NOT NULL,
	"value" real NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
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
CREATE TABLE IF NOT EXISTS "delegator_rewards" (
	"delegator" text PRIMARY KEY NOT NULL,
	"data" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE IF NOT EXISTS "key_value_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_health2" (
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
	"chain_id" text,
	"datetime" timestamp,
	"total_complaint_this_epoch" integer,
	"tx" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_spec_moniker" (
	"provider" text NOT NULL,
	"moniker" text,
	"spec" text,
	CONSTRAINT "provider_spec_moniker_provider_spec_pk" PRIMARY KEY("provider","spec")
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
CREATE TABLE IF NOT EXISTS "spec_tracked_info" (
	"provider" text NOT NULL,
	"chain_id" text NOT NULL,
	"iprpc_cu" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spec_tracked_info_provider_chain_id_pk" PRIMARY KEY("provider","chain_id")
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
CREATE TABLE IF NOT EXISTS "agg_alltime_relay_payments" (
	"provider" text,
	"spec_id" text,
	"cusum" bigint,
	"relaysum" bigint,
	"rewardsum" bigint,
	"qossyncavg" double precision,
	"qosavailabilityavg" double precision,
	"qoslatencyavg" double precision,
	"qossyncexcavg" double precision,
	"qosavailabilityexcavg" double precision,
	"qoslatencyexcavg" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agg_daily_relay_payments" (
	"provider" text,
	"dateday" timestamp,
	"spec_id" text,
	"cusum" bigint,
	"relaysum" bigint,
	"rewardsum" bigint,
	"qossyncavg" double precision,
	"qosavailabilityavg" double precision,
	"qoslatencyavg" double precision,
	"qossyncexcavg" double precision,
	"qosavailabilityexcavg" double precision,
	"qoslatencyexcavg" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agg_hourly_relay_payments" (
	"provider" text,
	"datehour" timestamp,
	"spec_id" text,
	"cusum" bigint,
	"relaysum" bigint,
	"rewardsum" bigint,
	"qossyncavg" double precision,
	"qosavailabilityavg" double precision,
	"qoslatencyavg" double precision,
	"qossyncexcavg" double precision,
	"qosavailabilityexcavg" double precision,
	"qoslatencyexcavg" double precision
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggConsumerAllTimeIdx" ON "agg_consumer_alltime_relay_payments" ("spec_id","consumer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggConsumerDailyIdx" ON "agg_consumer_daily_relay_payments" ("dateday","spec_id","consumer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggConsumerHourlyIdx" ON "agg_consumer_hourly_relay_payments" ("datehour","spec_id","consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aprIdx" ON "apr" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conflict_votes_provider_idx" ON "conflict_votes" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cslidx" ON "consumer_subscription_list" ("consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_provider_idx" ON "events" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "key_value_store_key_idx" ON "key_value_store" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ph2idx" ON "provider_health2" ("provider","spec","geolocation","interface","guid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health2_provider_idx" ON "provider_health2" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health2_timestamp_idx" ON "provider_health2" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_latest_block_reports_provider_idx" ON "provider_latest_block_reports" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_reported_provider_idx" ON "provider_reported" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "providerStakesIdx" ON "provider_stakes" ("provider","spec_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "name_idx" ON "relay_payments" ("spec_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ts_idx" ON "relay_payments" ("datetime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_idx" ON "relay_payments" ("consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_payments_provider_idx" ON "relay_payments" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_buys_consumer_idx" ON "subscription_buys" ("consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplyIdx" ON "supply" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggAllTimeIdx" ON "agg_alltime_relay_payments" ("spec_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggDailyIdx" ON "agg_daily_relay_payments" ("dateday","spec_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggHourlyIdx" ON "agg_hourly_relay_payments" ("datehour","spec_id","provider");

CREATE TABLE IF NOT EXISTS "apr_per_provider" (
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"value" real NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apr_per_provider_provider_type_pk" PRIMARY KEY("provider","type")
);