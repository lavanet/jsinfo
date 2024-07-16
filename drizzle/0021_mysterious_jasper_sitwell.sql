CREATE TABLE IF NOT EXISTS "provider_spec_moniker" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"moniker" text,
	"spec" text,
	"createdat" timestamp DEFAULT now() NOT NULL,
	"updatedat" timestamp DEFAULT CURRENT_TIMESTAMP(3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "psmidx" ON "provider_spec_moniker" ("provider","spec");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_spec_moniker" ADD CONSTRAINT "provider_spec_moniker_provider_providers_address_fk" FOREIGN KEY ("provider") REFERENCES "providers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_spec_moniker" ADD CONSTRAINT "provider_spec_moniker_spec_specs_id_fk" FOREIGN KEY ("spec") REFERENCES "specs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

--- THIS IS NOT IN THE DRIZZLE SCHEMA FILE:

-- Create a function to update the updatedat column
CREATE OR REPLACE FUNCTION update_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedat" = CURRENT_TIMESTAMP(3);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to use the function
CREATE TRIGGER update_provider_spec_moniker_updatedat BEFORE UPDATE
ON "provider_spec_moniker" FOR EACH ROW
EXECUTE FUNCTION update_updatedat_column();


-- INSERT INTO "provider_spec_moniker" ("provider", "moniker", "spec")
-- VALUES ('lava@1l0gcpxw6zrhsxjv68rzvscvcx4p9f07y7974r5', '', 'ARB1');

-- UPDATE "provider_spec_moniker"
-- SET "moniker" = 'moniker_updated'
-- WHERE "provider" = 'lava@1l0gcpxw6zrhsxjv68rzvscvcx4p9f07y7974r5' AND "spec" = 'ARB1';