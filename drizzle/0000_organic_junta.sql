
-- DROP TABLE IF EXISTS "blocks";
-- DROP TABLE IF EXISTS "consumer_subscription_list";
-- DROP TABLE IF EXISTS "provider_spec_moniker";
-- DROP TABLE IF EXISTS "provider_stakes";
-- DROP TABLE IF EXISTS "subscription_buys";
-- DROP TABLE IF EXISTS "supply";
-- DROP TABLE IF EXISTS "provider_health";
-- DROP TABLE IF EXISTS "relay_payments";
-- DROP TABLE IF EXISTS "provider_latest_block_reports";
-- DROP TABLE IF EXISTS "provider_reported";
-- DROP TABLE IF EXISTS "conflict_responses";
-- DROP TABLE IF EXISTS "dual_stacking_delegator_rewards";
-- DROP TABLE IF EXISTS "conflict_votes";
-- DROP TABLE IF EXISTS "events";


--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocks" (
	"height" integer,
	"datetime" timestamp,
	CONSTRAINT "blocks_height_unique" UNIQUE("height")
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
CREATE INDEX IF NOT EXISTS "cslidx" ON "consumer_subscription_list" ("consumer");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "psmidx" ON "provider_spec_moniker" ("provider","spec");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "providerStakesIdx" ON "provider_stakes" ("provider","spec_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplyIdx" ON "supply" ("key");
--> statement-breakpoint

--> --------- public.provider_health -------- 

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_health" (
    "id" serial NOT NULL,
    "provider" text,
    "timestamp" timestamp with time zone NOT NULL,
    "guid" text,
    "spec" text NOT NULL,
    "geolocation" text DEFAULT NULL,
    "interface" text DEFAULT NULL,
    "status" text NOT NULL,
    "data" text DEFAULT NULL,
    PRIMARY KEY (id, timestamp)
);

-- leave it for later - i am not sure i can have this with a unique idx with timestamp as well
-- SELECT create_hypertable('provider_health', 'timestamp');

CREATE UNIQUE INDEX IF NOT EXISTS "ph2idx" ON "provider_health" ("provider","spec","geolocation","interface","guid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_provider_idx" ON "provider_health" ("provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_timestamp_idx" ON "provider_health" ("timestamp");
--> statement-breakpoint



--> HyperTables


--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS timescaledb;
--> statement-breakpoint

--> --------- public.relay_payments -------- 
CREATE TABLE IF NOT EXISTS public.relay_payments (
    "id" serial NOT NULL,
    relays bigint,
    cu bigint,
    pay bigint,
    qos_sync real,
    qos_availability real,
    qos_latency real,
    qos_sync_exc real,
    qos_availability_exc real,
    qos_latency_exc real,
    provider text,
    spec_id text,
    block_id integer,
    consumer text,
    tx text,
    datetime timestamp with time zone NOT NULL,
    PRIMARY KEY (id, datetime)
);
--> statement-breakpoint
-- SELECT create_hypertable('relay_payments', 'datetime');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'relay_payments'
    ) THEN
        PERFORM create_hypertable('relay_payments', 'datetime', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "relay_payments" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS relay_payments_specid_idx ON public.relay_payments USING btree (spec_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS relay_payments_consumer_idx ON public.relay_payments USING btree (consumer);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS relay_payments_provider_idx ON public.relay_payments USING btree (provider);
 
--> --------- public.provider_latest_block_reports -------- 

CREATE TABLE IF NOT EXISTS "provider_latest_block_reports" (
    "id" serial NOT NULL,
    provider text,                                                                        
    block_id integer,                                                                     
    tx text,                                                                              
    timestamp timestamp with time zone NOT NULL,                                    
    chain_id text NOT NULL,                                                               
    chain_block_height bigint,
    PRIMARY KEY (id, timestamp)
);
--> statement-breakpoint

-- SELECT create_hypertable('provider_latest_block_reports', 'timestamp');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'provider_latest_block_reports'
    ) THEN
        PERFORM create_hypertable('provider_latest_block_reports', 'timestamp', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "provider_latest_block_reports" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "provider_latest_block_reports_provider_idx" ON "provider_latest_block_reports" ("provider");

--> --------- public.provider_reported -------- 
CREATE TABLE IF NOT EXISTS "provider_reported" (
    "id" serial NOT NULL,
	"provider" text,
	"block_id" integer,
	"cu" bigint,
	"disconnections" integer,
	"epoch" integer,
	"errors" integer,
	"project" text,
	"datetime" timestamp with time zone NOT NULL,    
	"total_complaint_this_epoch" integer,
	"tx" text,
	PRIMARY KEY (id, datetime)
);
--> statement-breakpoint
-- SELECT create_hypertable('provider_reported', 'datetime');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'provider_reported'
    ) THEN
        PERFORM create_hypertable('provider_reported', 'datetime', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "provider_reported" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_reported_provider_idx" ON "provider_reported" ("provider");

--> --------- public.conflict_responses -------- 
CREATE TABLE IF NOT EXISTS "conflict_responses" (
	"id" serial NOT NULL,
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
	"request_data" text,
	"timestamp" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id, timestamp)
);

--> statement-breakpoint
-- SELECT create_hypertable('conflict_responses', 'timestamp');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'conflict_responses'
    ) THEN
        PERFORM create_hypertable('conflict_responses', 'timestamp', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "conflict_responses" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conflict_responses_consumer_idx" ON "conflict_responses" ("consumer");

--> --------- public.dual_stacking_delegator_rewards -------- 

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dual_stacking_delegator_rewards" (
	"id" serial NOT NULL,
	"provider" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,   
	"chain_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"denom" text NOT NULL,
	PRIMARY KEY (id, timestamp)
);

--> statement-breakpoint
-- SELECT create_hypertable('dual_stacking_delegator_rewards', 'timestamp');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'dual_stacking_delegator_rewards'
    ) THEN
        PERFORM create_hypertable('dual_stacking_delegator_rewards', 'timestamp', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "dual_stacking_delegator_rewards" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dual_stacking_delegator_rewards_provider_idx" ON "dual_stacking_delegator_rewards" ("provider");

--> --------- public.conflict_votes -------- 

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conflict_votes (
    id serial NOT NULL,
    vote_id text,
    block_id integer,
    provider text,
    tx text,
    timestamp timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, timestamp)
);

--> statement-breakpoint
-- SELECT create_hypertable('conflict_votes', 'timestamp');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'conflict_votes'
    ) THEN
        PERFORM create_hypertable('conflict_votes', 'timestamp', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "conflict_votes" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conflict_votes_provider_idx" ON "conflict_votes" ("provider");

--> --------- public.events -------- 

CREATE TABLE IF NOT EXISTS "events" (
	"id" serial NOT NULL,
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
	"timestamp" timestamp with time zone NOT NULL,
    PRIMARY KEY (id, timestamp)
);

--> statement-breakpoint
-- SELECT create_hypertable('events', 'timestamp');
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'events'
    ) THEN
        PERFORM create_hypertable('events', 'timestamp', if_not_exists => TRUE);
    ELSE
        RAISE NOTICE 'Table "events" is already a hypertable. Skipping hypertable creation.';
    END IF;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_provider_idx" ON "events" ("provider");