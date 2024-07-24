CREATE TABLE IF NOT EXISTS "supply" (
	"key" text NOT NULL,
	"amount" bigint NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplyIdx" ON "supply" ("key");