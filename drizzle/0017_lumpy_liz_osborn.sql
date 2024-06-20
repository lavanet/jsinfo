CREATE TABLE IF NOT EXISTS "provider_health" (
	"id" serial PRIMARY KEY NOT NULL,
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
CREATE INDEX IF NOT EXISTS "provider_health_provider_idx" ON "provider_health" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health_timestamp_idx" ON "provider_health" ("timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_health" ADD CONSTRAINT "provider_health_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
