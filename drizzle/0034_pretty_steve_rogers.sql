CREATE TABLE IF NOT EXISTS "apr" (
	"key" text PRIMARY KEY NOT NULL,
	"value" real NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aprIdx" ON "apr" ("key");

INSERT INTO apr ("key", "value", "timestamp") VALUES
('staking_apr_percentile', 0, CURRENT_TIMESTAMP),
('restaking_apr_percentile', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;