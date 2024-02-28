CREATE TABLE IF NOT EXISTS "provider_health_hourly" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text,
	"timestamp" timestamp NOT NULL,
	"spec" varchar(255) NOT NULL,
	"interface" varchar(255) DEFAULT NULL,
	"status" varchar(10) NOT NULL,
	"message" varchar(255) DEFAULT NULL,
	"block" integer DEFAULT NULL,
	"latency" integer DEFAULT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_health_hourly" ADD CONSTRAINT "provider_health_hourly_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
