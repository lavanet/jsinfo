CREATE INDEX IF NOT EXISTS "provider_idx" ON "provider_health_hourly" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timestamp_idx" ON "provider_health_hourly" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consumer_idx" ON "relay_payments" ("consumer");