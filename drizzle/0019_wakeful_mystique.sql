CREATE TABLE IF NOT EXISTS "agg_consumer_alltime_relay_payments" (
	"consumer" text,
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
CREATE TABLE IF NOT EXISTS "agg_consumer_daily_relay_payments" (
	"consumer" text,
	"dateday" timestamp,
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
CREATE TABLE IF NOT EXISTS "agg_consumer_hourly_relay_payments" (
	"consumer" text,
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
CREATE TABLE IF NOT EXISTS "agg_alltime_relay_payments" (
	"provider" text,
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
CREATE TABLE IF NOT EXISTS "agg_daily_relay_payments" (
	"provider" text,
	"dateday" timestamp,
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
ALTER TABLE "provider_stakes" DROP CONSTRAINT "provider_stakes_provider_spec_id_pk";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggConsumerAllTimeIdx" ON "agg_consumer_alltime_relay_payments" ("spec_id","consumer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggConsumerDailyIdx" ON "agg_consumer_daily_relay_payments" ("dateday","spec_id","consumer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggConsumerHourlyIdx" ON "agg_consumer_hourly_relay_payments" ("datehour","spec_id","consumer");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggAllTimeIdx" ON "agg_alltime_relay_payments" ("spec_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aggDailyIdx" ON "agg_daily_relay_payments" ("dateday","spec_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "providerStakesIdx" ON "provider_stakes" ("provider","spec_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_consumer_alltime_relay_payments" ADD CONSTRAINT "agg_consumer_alltime_relay_payments_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_consumer_alltime_relay_payments" ADD CONSTRAINT "agg_consumer_alltime_relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_consumer_daily_relay_payments" ADD CONSTRAINT "agg_consumer_daily_relay_payments_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_consumer_daily_relay_payments" ADD CONSTRAINT "agg_consumer_daily_relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_consumer_hourly_relay_payments" ADD CONSTRAINT "agg_consumer_hourly_relay_payments_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_consumer_hourly_relay_payments" ADD CONSTRAINT "agg_consumer_hourly_relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_alltime_relay_payments" ADD CONSTRAINT "agg_alltime_relay_payments_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_alltime_relay_payments" ADD CONSTRAINT "agg_alltime_relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_daily_relay_payments" ADD CONSTRAINT "agg_daily_relay_payments_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agg_daily_relay_payments" ADD CONSTRAINT "agg_daily_relay_payments_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
