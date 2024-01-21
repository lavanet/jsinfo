ALTER TABLE "provider_stakes" DROP CONSTRAINT "provider_stakes_provider_spec_id";--> statement-breakpoint
ALTER TABLE "provider_stakes" ADD CONSTRAINT "provider_stakes_provider_spec_id_pk" PRIMARY KEY("provider","spec_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ts_idx" ON "relay_payments" ("datetime");