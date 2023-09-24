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
	"provider" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumers" (
	"address" text,
	CONSTRAINT "consumers_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" integer,
	"provider" text,
	"block_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" text,
	"desc" text,
	"pay" bigint,
	CONSTRAINT "plans_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_stakes" (
	"stake" integer,
	"applied_height" integer,
	"provider" text,
	"spec_id" text,
	"block_id" integer,
	CONSTRAINT provider_stakes_provider_spec_id PRIMARY KEY("provider","spec_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "providers" (
	"address" text,
	"moniker" text,
	CONSTRAINT "providers_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relay_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"relays" integer,
	"cu" integer,
	"pay" integer,
	"qos_sync" real,
	"qos_availability" real,
	"qos_latency" real,
	"qos_sync_exc" real,
	"qos_availability_exc" real,
	"qos_latency_exc" real,
	"provider" text,
	"spec_id" text,
	"block_id" integer,
	"consumer" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "specs" (
	"id" text,
	CONSTRAINT "specs_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_buys" (
	"block_id" integer,
	"consumer" text,
	"number" integer,
	"plan" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_responses" ADD CONSTRAINT "conflict_responses_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_responses" ADD CONSTRAINT "conflict_responses_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_responses" ADD CONSTRAINT "conflict_responses_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_votes" ADD CONSTRAINT "conflict_votes_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_votes" ADD CONSTRAINT "conflict_votes_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_stakes" ADD CONSTRAINT "provider_stakes_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_stakes" ADD CONSTRAINT "provider_stakes_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_stakes" ADD CONSTRAINT "provider_stakes_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_payments" ADD CONSTRAINT "relay_payments_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_payments" ADD CONSTRAINT "relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_payments" ADD CONSTRAINT "relay_payments_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_payments" ADD CONSTRAINT "relay_payments_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_buys" ADD CONSTRAINT "subscription_buys_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_buys" ADD CONSTRAINT "subscription_buys_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_buys" ADD CONSTRAINT "subscription_buys_plan_plans_id_fk" FOREIGN KEY ("plan") REFERENCES "plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
