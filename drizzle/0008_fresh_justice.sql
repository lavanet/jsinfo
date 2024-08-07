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
ALTER TABLE "relay_payments" ADD COLUMN "datetime" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggHourlyIdx" ON "agg_hourly_relay_payments" ("datehour","spec_id","provider");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_hourly_relay_payments" ADD CONSTRAINT "agg_hourly_relay_payments_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_hourly_relay_payments" ADD CONSTRAINT "agg_hourly_relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- fixing missing timestamp field on altered relay_payments table
UPDATE "relay_payments"
SET "datetime" = (
    SELECT "blocks"."datetime"
    FROM "blocks"
    WHERE "relay_payments"."block_id" = "blocks"."height"
);
