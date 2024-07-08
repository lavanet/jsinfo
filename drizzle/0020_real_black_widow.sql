CREATE INDEX IF NOT EXISTS "conflict_votes_provider_idx" ON "conflict_votes" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dual_stacking_delegator_rewards_provider_idx" ON "dual_stacking_delegator_rewards" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_provider_idx" ON "events" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_latest_block_reports_provider_idx" ON "provider_latest_block_reports" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_reported_provider_idx" ON "provider_reported" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_payments_provider_idx" ON "relay_payments" ("provider");