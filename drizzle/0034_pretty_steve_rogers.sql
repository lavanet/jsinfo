CREATE TABLE IF NOT EXISTS "apr" (
	"key" text PRIMARY KEY NOT NULL,
	"value" real NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aprIdx" ON "apr" ("key");