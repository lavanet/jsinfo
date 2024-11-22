CREATE INDEX IF NOT EXISTS "subscription_buys_consumer_idx" ON "subscription_buys" ("consumer");--> statement-breakpoint
ALTER TABLE "provider_spec_moniker" DROP COLUMN IF EXISTS "id";--> statement-breakpoint
ALTER TABLE "provider_spec_moniker" DROP COLUMN IF EXISTS "createdat";--> statement-breakpoint
ALTER TABLE "provider_spec_moniker" DROP COLUMN IF EXISTS "updatedat";