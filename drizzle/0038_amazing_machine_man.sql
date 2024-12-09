DROP INDEX IF EXISTS "psmidx";--> statement-breakpoint
ALTER TABLE "provider_spec_moniker" ADD CONSTRAINT "provider_spec_moniker_provider_spec_pk" PRIMARY KEY("provider","spec");