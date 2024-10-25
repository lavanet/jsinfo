CREATE TABLE IF NOT EXISTS "key_value_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "key_value_store_key_idx" ON "key_value_store" ("key");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

--> statement-breakpoint
CREATE TRIGGER update_key_value_store_modtime
    BEFORE UPDATE ON "key_value_store"
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();