-- Custom SQL migration file, put you code below! --
ALTER TABLE relay_payments ALTER COLUMN pay TYPE bigint USING pay::bigint;
ALTER TABLE events ALTER COLUMN b1 TYPE bigint USING b1::bigint;
ALTER TABLE events ALTER COLUMN b2 TYPE bigint USING b2::bigint;
ALTER TABLE events ALTER COLUMN b3 TYPE bigint USING b3::bigint;
ALTER TABLE dual_stacking_delegator_rewards ALTER COLUMN amount TYPE bigint USING amount::bigint;