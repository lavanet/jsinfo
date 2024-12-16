CREATE TABLE IF NOT EXISTS "consumer_optimizer_metrics_agg" (
	"id" serial NOT NULL,
	"created_at" timestamp with time zone,
	"timestamp" timestamp with time zone,
	"consumer" text,
	"chain_id" text,
	"latency_score" numeric,
	"availability_score" numeric,
	"sync_score" numeric,
	"node_error_rate" numeric,
	"provider" text,
	"provider_stake" bigint,
	"entry_index" numeric,
	"consumer_hostname" text,
	"generic_score" numeric,
	"epoch" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consumer_optimizer_metrics_agg_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_from" timestamp with time zone,
	"last_to" timestamp with time zone,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_optimizer_metrics_agg_consumer_idx" ON "consumer_optimizer_metrics_agg" ("consumer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_optimizer_metrics_agg_hostname_idx" ON "consumer_optimizer_metrics_agg" ("consumer_hostname");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_optimizer_metrics_agg_chain_idx" ON "consumer_optimizer_metrics_agg" ("chain_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_optimizer_metrics_agg_provider_idx" ON "consumer_optimizer_metrics_agg" ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consumer_optimizer_metrics_agg_unique_idx" ON "consumer_optimizer_metrics_agg" ("timestamp","consumer","chain_id","provider","consumer_hostname");


-- GRANT ALL PRIVILEGES ON TABLE consumer_optimizer_metrics_agg_times TO jsinfo;
-- GRANT ALL PRIVILEGES ON TABLE consumer_optimizer_metrics_agg TO jsinfo;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jsinfo;