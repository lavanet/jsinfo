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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ph2idx" ON "provider_health2" ("provider","spec","geolocation","interface","guid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health2_provider_idx" ON "provider_health2" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_health2_timestamp_idx" ON "provider_health2" ("timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_health2" ADD CONSTRAINT "provider_health2_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

INSERT INTO "unique_visitors" ("timestamp", "value") VALUES
('2023-07-21', 74899),
('2023-07-22', 123629),
('2023-07-23', 91242),
('2023-07-24', 80877),
('2023-07-25', 78870),
('2023-07-26', 90323),
('2023-07-27', 72563),
('2023-07-28', 64798),
('2023-07-29', 72809),
('2023-07-30', 124049),
('2023-07-31', 129330),
('2023-08-01', 135893),
('2023-08-02', 127403),
('2023-08-03', 110376),
('2023-08-04', 107232),
('2023-08-05', 128450),
('2023-08-06', 132260),
('2023-08-07', 136603),
('2023-08-08', 150081),
('2023-08-09', 160409),
('2023-08-10', 147368),
('2023-08-11', 139764),
('2023-08-12', 158252),
('2023-08-13', 155363),
('2023-08-14', 172072),
('2023-08-15', 163546),
('2023-08-16', 152826),
('2023-08-17', 139213),
('2023-08-18', 140847),
('2023-08-19', 156530);