CREATE TABLE IF NOT EXISTS "apr" (
	"key" text NOT NULL,
	"value" real NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aprIdx" ON "apr" ("key");