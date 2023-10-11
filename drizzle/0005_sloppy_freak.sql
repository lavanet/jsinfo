CREATE TABLE IF NOT EXISTS "txs" (
	"tx_hash" text,
	"block_id" integer,
	CONSTRAINT "txs_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
ALTER TABLE "conflict_responses" ADD COLUMN "tx" text;--> statement-breakpoint
ALTER TABLE "conflict_votes" ADD COLUMN "tx" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "t1" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "t2" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "t3" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "b1" bigint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "b2" bigint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "b3" bigint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "i1" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "i2" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "i3" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "r1" real;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "r2" real;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "r3" real;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "consumer" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tx" text;--> statement-breakpoint
ALTER TABLE "provider_reported" ADD COLUMN "tx" text;--> statement-breakpoint
ALTER TABLE "relay_payments" ADD COLUMN "tx" text;--> statement-breakpoint
ALTER TABLE "subscription_buys" ADD COLUMN "tx" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_responses" ADD CONSTRAINT "conflict_responses_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflict_votes" ADD CONSTRAINT "conflict_votes_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_reported" ADD CONSTRAINT "provider_reported_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_payments" ADD CONSTRAINT "relay_payments_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_buys" ADD CONSTRAINT "subscription_buys_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "txs" ADD CONSTRAINT "txs_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
