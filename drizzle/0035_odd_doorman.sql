CREATE TABLE IF NOT EXISTS "delegator_rewards" (
	"delegator" text PRIMARY KEY NOT NULL,
	"data" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- DROP TABLE "dual_stacking_delegator_rewards";