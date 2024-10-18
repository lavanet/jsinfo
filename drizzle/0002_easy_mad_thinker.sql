--> active_providers
DROP MATERIALIZED VIEW IF EXISTS active_providers;

CREATE MATERIALIZED VIEW active_providers AS
SELECT 
    ps.provider,
    agg_data.last_active,
    agg_data.total_relays,
    CONCAT(
        SUM(CASE WHEN ps.status = 1 THEN 1 ELSE 0 END), 
        ' / ', 
        COUNT(ps.spec_id)
    ) as totalservices,
    COALESCE(SUM(ps.stake + LEAST(ps.delegate_total, ps.delegate_limit)), 0) AS totalstake,
    agg_data.rewardsum,
    (SELECT MAX(moniker) FROM provider_spec_moniker WHERE provider = ps.provider) as moniker
FROM 
    provider_stakes ps
LEFT JOIN LATERAL (
    SELECT 
        provider,
        MAX(bucket_15min) as last_active,
        COALESCE(SUM(relaysum), 0) as total_relays,
        COALESCE(SUM(rewardsum), 0) as rewardsum
    FROM 
        agg_15min_provider_relay_payments
    WHERE 
        provider = ps.provider
    GROUP BY 
        provider
    HAVING 
        MAX(bucket_15min) > NOW() - INTERVAL '30 day'
        AND COALESCE(SUM(relaysum), 0) > 1
) agg_data ON TRUE
WHERE 
    ps.status != 2 
    AND ps.provider IS NOT NULL 
    AND ps.provider != ''
GROUP BY 
    ps.provider,
    agg_data.last_active,
    agg_data.total_relays,
    agg_data.rewardsum
HAVING 
    agg_data.last_active IS NOT NULL;

CREATE UNIQUE INDEX ON active_providers (provider);

--> active_and_inactive_providers

DROP MATERIALIZED VIEW IF EXISTS active_and_inactive_providers;

CREATE MATERIALIZED VIEW active_and_inactive_providers AS
SELECT 
    ps.provider,
    agg_data.total_relays,
    CONCAT(
        SUM(CASE WHEN ps.status = 1 THEN 1 ELSE 0 END), 
        ' / ', 
        COUNT(ps.spec_id)
    ) as totalservices,
    COALESCE(SUM(ps.stake + LEAST(ps.delegate_total, ps.delegate_limit)), 0) AS totalstake,
    agg_data.rewardsum,
    (SELECT MAX(moniker) FROM provider_spec_moniker WHERE provider = ps.provider) as moniker
FROM 
    provider_stakes ps
LEFT JOIN LATERAL (
    SELECT 
        provider,
        COALESCE(SUM(relaysum), 0) as total_relays,
        COALESCE(SUM(rewardsum), 0) as rewardsum
    FROM 
        agg_15min_provider_relay_payments
    WHERE 
        provider = ps.provider
    GROUP BY 
        provider
) agg_data ON TRUE
WHERE 
    ps.provider IS NOT NULL 
    AND ps.provider != ''
GROUP BY 
    ps.provider,
    agg_data.total_relays,
    agg_data.rewardsum

CREATE UNIQUE INDEX ON active_and_inactive_providers (provider);