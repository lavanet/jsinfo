CREATE TABLE IF NOT EXISTS "dual_stacking_delegator_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"provider" text NOT NULL,
	"chain_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"denom" text NOT NULL
);
