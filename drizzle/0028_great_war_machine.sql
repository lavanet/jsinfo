CREATE TABLE IF NOT EXISTS "provider_health2" (
	"id" serial NOT NULL,
	"provider" text,
	"timestamp" timestamp NOT NULL,
	"guid" text,
	"spec" varchar(50) NOT NULL,
	"geolocation" varchar(10) DEFAULT NULL,
	"interface" varchar(50) DEFAULT NULL,
	"status" varchar(10) NOT NULL,
	"data" varchar(1024) DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"value" integer
);

CREATE UNIQUE INDEX timestamp_unique_idx ON unique_visitors(timestamp);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ph2idx" ON "provider_health2" ("provider","spec","geolocation","interface","guid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health2_provider_idx" ON "provider_health2" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health2_timestamp_idx" ON "provider_health2" ("timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_health2" ADD CONSTRAINT "provider_health2_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;


