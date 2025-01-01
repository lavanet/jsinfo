CREATE TABLE IF NOT EXISTS "supply_history" (
	"key" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_history_key_idx" ON "supply_history" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_history_type_idx" ON "supply_history" ("type");

# GRANT ALL PRIVILEGES ON TABLE supply_history TO jsinfo;