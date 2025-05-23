-- DROP TABLE "consumers";--> statement-breakpoint
-- DROP TABLE "plans";--> statement-breakpoint
-- DROP TABLE "provider_accountinfo";--> statement-breakpoint
-- DROP TABLE "providers";--> statement-breakpoint
-- DROP TABLE "specs";--> statement-breakpoint
-- DROP TABLE "txs";--> statement-breakpoint
-- DROP TABLE "unique_visitors";--> statement-breakpoint
-- DROP TABLE "visitor_metrics";--> statement-breakpoint
ALTER TABLE "agg_consumer_alltime_relay_payments" DROP CONSTRAINT IF EXISTS "agg_consumer_alltime_relay_payments_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "agg_consumer_alltime_relay_payments" DROP CONSTRAINT IF EXISTS "agg_consumer_alltime_relay_payments_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "agg_consumer_daily_relay_payments" DROP CONSTRAINT IF EXISTS "agg_consumer_daily_relay_payments_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "agg_consumer_daily_relay_payments" DROP CONSTRAINT IF EXISTS "agg_consumer_daily_relay_payments_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "agg_consumer_hourly_relay_payments" DROP CONSTRAINT IF EXISTS "agg_consumer_hourly_relay_payments_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "agg_consumer_hourly_relay_payments" DROP CONSTRAINT IF EXISTS "agg_consumer_hourly_relay_payments_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "conflict_responses" DROP CONSTRAINT IF EXISTS "conflict_responses_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "conflict_responses" DROP CONSTRAINT IF EXISTS "conflict_responses_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "conflict_responses" DROP CONSTRAINT IF EXISTS "conflict_responses_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "conflict_responses" DROP CONSTRAINT IF EXISTS "conflict_responses_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "conflict_votes" DROP CONSTRAINT IF EXISTS "conflict_votes_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "conflict_votes" DROP CONSTRAINT IF EXISTS "conflict_votes_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "conflict_votes" DROP CONSTRAINT IF EXISTS "conflict_votes_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "consumer_subscription_list" DROP CONSTRAINT IF EXISTS "consumer_subscription_list_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "dual_stacking_delegator_rewards" DROP CONSTRAINT IF EXISTS "dual_stacking_delegator_rewards_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "provider_health2" DROP CONSTRAINT IF EXISTS "provider_health2_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "provider_latest_block_reports" DROP CONSTRAINT IF EXISTS "provider_latest_block_reports_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "provider_latest_block_reports" DROP CONSTRAINT IF EXISTS "provider_latest_block_reports_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "provider_latest_block_reports" DROP CONSTRAINT IF EXISTS "provider_latest_block_reports_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "provider_reported" DROP CONSTRAINT IF EXISTS "provider_reported_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "provider_reported" DROP CONSTRAINT IF EXISTS "provider_reported_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "provider_reported" DROP CONSTRAINT IF EXISTS "provider_reported_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "provider_spec_moniker" DROP CONSTRAINT IF EXISTS "provider_spec_moniker_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "provider_spec_moniker" DROP CONSTRAINT IF EXISTS "provider_spec_moniker_spec_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "provider_stakes" DROP CONSTRAINT IF EXISTS "provider_stakes_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "provider_stakes" DROP CONSTRAINT IF EXISTS "provider_stakes_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "provider_stakes" DROP CONSTRAINT IF EXISTS "provider_stakes_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "relay_payments" DROP CONSTRAINT IF EXISTS "relay_payments_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "relay_payments" DROP CONSTRAINT IF EXISTS "relay_payments_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "relay_payments" DROP CONSTRAINT IF EXISTS "relay_payments_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "relay_payments" DROP CONSTRAINT IF EXISTS "relay_payments_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "relay_payments" DROP CONSTRAINT IF EXISTS "relay_payments_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "subscription_buys" DROP CONSTRAINT IF EXISTS "subscription_buys_block_id_blocks_height_fk";
--> statement-breakpoint
ALTER TABLE "subscription_buys" DROP CONSTRAINT IF EXISTS "subscription_buys_consumer_consumers_address_fk";
--> statement-breakpoint
ALTER TABLE "subscription_buys" DROP CONSTRAINT IF EXISTS "subscription_buys_plan_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_buys" DROP CONSTRAINT IF EXISTS "subscription_buys_tx_txs_tx_hash_fk";
--> statement-breakpoint
ALTER TABLE "agg_alltime_relay_payments" DROP CONSTRAINT IF EXISTS "agg_alltime_relay_payments_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "agg_alltime_relay_payments" DROP CONSTRAINT IF EXISTS "agg_alltime_relay_payments_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "agg_daily_relay_payments" DROP CONSTRAINT IF EXISTS "agg_daily_relay_payments_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "agg_daily_relay_payments" DROP CONSTRAINT IF EXISTS "agg_daily_relay_payments_spec_id_specs_id_fk";
--> statement-breakpoint
ALTER TABLE "agg_hourly_relay_payments" DROP CONSTRAINT IF EXISTS "agg_hourly_relay_payments_provider_providers_address_fk";
--> statement-breakpoint
ALTER TABLE "agg_hourly_relay_payments" DROP CONSTRAINT IF EXISTS "agg_hourly_relay_payments_spec_id_specs_id_fk";
