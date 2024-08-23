CREATE TABLE IF NOT EXISTS "visitor_metrics" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vmidx" ON "visitor_metrics" ("key");

INSERT INTO "visitor_metrics" ("key", "value") VALUES ('Unique Users (30 days)', '2.07M')
ON CONFLICT ("key") DO NOTHING;