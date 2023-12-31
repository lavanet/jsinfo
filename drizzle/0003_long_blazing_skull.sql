-- Custom SQL migration file, put you code below! --
CREATE MATERIALIZED VIEW "relay_payments_agg_view" AS
SELECT "relay_payments"."provider",
       DATE("blocks"."datetime"),
       "relay_payments"."spec_id",
       sum("relay_payments"."cu") as cuSum,
       sum("relay_payments"."relays") as relaySum,
       sum("relay_payments"."pay") as rewardSum,
       sum("relay_payments"."qos_sync"*"relay_payments"."relays")/sum("relay_payments"."relays") as qosSyncAvg,
       sum("relay_payments"."qos_availability"*"relay_payments"."relays")/sum("relay_payments"."relays") as qosAvailabilityAvg,
       sum("relay_payments"."qos_latency"*"relay_payments"."relays")/sum("relay_payments"."relays") as qosLatencyAvg,
       sum("relay_payments"."qos_sync_exc"*"relay_payments"."relays")/sum("relay_payments"."relays") as qosSyncExcAvg,
       sum("relay_payments"."qos_availability_exc"*"relay_payments"."relays")/sum("relay_payments"."relays") as qosAvailabilityExcAvg,
       sum("relay_payments"."qos_latency_exc"*"relay_payments"."relays")/sum("relay_payments"."relays") as qosLatencyExcAvg
FROM "relay_payments"
LEFT JOIN "blocks" ON "relay_payments"."block_id" = "blocks"."height"
GROUP BY "relay_payments"."spec_id",
         DATE("blocks"."datetime"),
         "relay_payments"."provider"
ORDER BY DATE("blocks"."datetime");

CREATE UNIQUE INDEX ON relay_payments_agg_view (date, spec_id, provider);
