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
DO $$ BEGIN
 ALTER TABLE "dual_stacking_delegator_rewards" ADD CONSTRAINT "dual_stacking_delegator_rewards_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_latest_block_reports" ADD CONSTRAINT "provider_latest_block_reports_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_latest_block_reports" ADD CONSTRAINT "provider_latest_block_reports_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_latest_block_reports" ADD CONSTRAINT "provider_latest_block_reports_tx_txs_tx_hash_fk" FOREIGN KEY ("tx") REFERENCES "txs"("tx_hash") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
