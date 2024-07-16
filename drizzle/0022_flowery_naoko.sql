CREATE TABLE IF NOT EXISTS "consumer_subscription_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"consumer" text NOT NULL,
	"plan" text,
	"fulltext" text,
	"createdat" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cslidx" ON "consumer_subscription_list" ("consumer");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consumer_subscription_list" ADD CONSTRAINT "consumer_subscription_list_consumer_consumers_address_fk" FOREIGN KEY ("consumer") REFERENCES "consumers"("address") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
