-- Create agg_15min_consumer_relay_payments if it doesn't already exist

CREATE MATERIALIZED VIEW IF NOT EXISTS agg_15min_consumer_relay_payments
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', datetime) AS bucket_15min,
    consumer,
    spec_id,
    SUM(cu) AS cusum,
    SUM(relays) AS relaysum,
    SUM(pay) AS rewardsum,
    SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0) AS qossyncavg,
    SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0) AS qosavailabilityavg,
    SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0) AS qoslatencyavg
FROM relay_payments
GROUP BY bucket_15min, consumer, spec_id
WITH NO DATA;


--> statement-breakpoint

-- Create indexes for agg_15min_consumer_relay_payments
CREATE INDEX IF NOT EXISTS agg_15min_consumer_relay_payments_spec_provider_idx 
ON agg_15min_consumer_relay_payments (spec_id, consumer);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS agg_15min_consumer_relay_payments_provider_idx 
ON agg_15min_consumer_relay_payments (consumer);

--> statement-breakpoint

-- Create agg_total_consumer_relay_payments if it doesn't already exist
CREATE MATERIALIZED VIEW IF NOT EXISTS agg_total_consumer_relay_payments AS
SELECT
    consumer,
    spec_id,
    SUM(cu) AS total_cusum,
    SUM(relays) AS total_relaysum,
    SUM(pay) AS total_rewardsum,
    SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0) AS qossyncavg,
    SUM(qos_sync_exc * relays) / NULLIF(SUM(CASE WHEN qos_sync_exc IS NOT NULL THEN relays ELSE 0 END), 0) AS qossyncexcavg,
    SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0) AS qosavailabilityavg,
    SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0) AS qoslatencyavg
FROM relay_payments
GROUP BY consumer, spec_id;


--> statement-breakpoint

-- Create indexes for agg_total_consumer_relay_payments
CREATE UNIQUE INDEX IF NOT EXISTS agg_total_consumer_relay_payments_spec_consumer_idx 
ON agg_total_consumer_relay_payments (spec_id, consumer);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS agg_total_consumer_relay_payments_consumer_idx 
ON agg_total_consumer_relay_payments (consumer);

--> statement-breakpoint

-- Create agg_15min_provider_relay_payments if it doesn't already exist
CREATE MATERIALIZED VIEW IF NOT EXISTS agg_15min_provider_relay_payments
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('15 minutes', datetime) AS bucket_15min,
    provider,
    spec_id,
    SUM(cu) AS cuSum,
    SUM(relays) AS relaySum,
    SUM(pay) AS rewardsum,
    SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0) AS qosSyncAvg,
    SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0) AS qosAvailabilityAvg,
    SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0) AS qosLatencyAvg
FROM relay_payments
GROUP BY bucket_15min, provider, spec_id
WITH NO DATA;

--> statement-breakpoint

-- Create indexes for agg_15min_provider_relay_payments
CREATE INDEX IF NOT EXISTS agg_15min_provider_relay_payments_spec_provider_idx 
ON agg_15min_provider_relay_payments (spec_id, provider);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS agg_15min_provider_relay_payments_provider_idx 
ON agg_15min_provider_relay_payments (provider);

--> statement-breakpoint

-- Create agg_total_provider_relay_payments if it doesn't already exist
CREATE MATERIALIZED VIEW IF NOT EXISTS agg_total_provider_relay_payments AS
SELECT
    provider,
    spec_id,
    SUM(cu) AS total_cusum,
    SUM(relays) AS total_relaysum,
    SUM(pay) AS total_rewardsum,
    SUM(qos_sync * relays) / NULLIF(SUM(CASE WHEN qos_sync IS NOT NULL THEN relays ELSE 0 END), 0) AS qossyncavg,
    SUM(qos_availability * relays) / NULLIF(SUM(CASE WHEN qos_availability IS NOT NULL THEN relays ELSE 0 END), 0) AS qosavailabilityavg,
    SUM(qos_latency * relays) / NULLIF(SUM(CASE WHEN qos_latency IS NOT NULL THEN relays ELSE 0 END), 0) AS qoslatencyavg
FROM relay_payments
GROUP BY provider, spec_id;

--> statement-breakpoint

-- Create indexes for agg_total_provider_relay_payments
CREATE UNIQUE INDEX IF NOT EXISTS agg_total_provider_relay_payments_spec_provider_idx 
ON agg_total_provider_relay_payments (spec_id, provider);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS agg_total_provider_relay_payments_provider_idx 
ON agg_total_provider_relay_payments (provider);

--> statement-breakpoint
