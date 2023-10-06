CREATE TABLE IF NOT EXISTS "provider_reported" (
	"provider" text,
	"block_id" integer,
	"cu" bigint,
	"disconnections" integer,
	"epoch" integer,
	"errors" integer,
	"project" text,
	"datetime" timestamp,
	"total_complaint_this_epoch" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_reported" ADD CONSTRAINT "provider_reported_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_reported" ADD CONSTRAINT "provider_reported_block_id_blocks_height_fk" FOREIGN KEY ("block_id") REFERENCES "blocks"("height") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
