CREATE TABLE IF NOT EXISTS "provider_accountinfo" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text,
	"timestamp" timestamp NOT NULL,
	"data" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_accountinfo_provider_idx" ON "provider_accountinfo" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_accountinfo_timestamp_idx" ON "provider_accountinfo" ("timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_accountinfo" ADD CONSTRAINT "provider_accountinfo_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
