# JSInfo API Handlers Documentation

## Health Endpoints

#### `/health`

- Basic health check endpoint
- Returns `{ health: "ok" }`

#### `/latest`

- Returns latest block height and datetime
- Used for monitoring blockchain sync status

#### `/islatest`

- Checks if block data is within 15 minutes of current time
- Returns block height, datetime, and status
- Used for monitoring data freshness

## Core Data Endpoints

#### `/listProviders`

Returns a comprehensive list of all Lava Network providers, including:

- Provider addresses and display names (monikers)
- Supported chains and specifications
- Staking details (amounts, delegation limits)
- Commission rates and current status

#### `/providers`

Returns list of all providers

#### `/consumers`

Returns list of all consumers

#### `/specs`

Returns list of all specs/chains

## Supply Endpoints

#### `/supply/circulating`

- Returns the current circulating supply of LAVA tokens in LAVA denomination as a plain text number string

#### `/supply/total`

- Returns the total supply of LAVA tokens

## Chain Wallet Statistics

#### `/lava_chain_stakers`

#### `/lava_chain_restakers`

- Returns current and monthly unique staker counts
- Response format:

```json
{
  "total": "<current_unique_stakers>",
  "monthly": "<monthly_unique_stakers>"
}
```

### Important Notes:

1. Stakers vs Restakers:

   - Stakers: Users delegating through Cosmos API to validators
   - Restakers: Users using Lava CLI for dual staking to providers

2. Unique User Counting:

   - A wallet delegating to multiple validators counts as one unique user
   - Empty provider delegations are excluded from restaker counts

3. Monthly Metrics:
   - Represent unique users over the trailing 30-day period
   - Updated continuously based on blockchain data

## APR (Annual Percentage Rate) Endpoint

#### `/apr`

### Description

Returns the 80th percentile APR values for both staking and restaking options in the Lava Network.

### Response Format

```json
{
  "staking_apr_percentile": 0.18205652, // ~18.2% APR
  "restaking_apr_percentile": 0.0012732032 // ~0.13% APR
}
```

### Calculation Method

#### APR Calculation Method

Both staking and restaking APRs are calculated similarly:

1. Query estimated rewards for all validators/providers using:

   ```
   # For validators (staking):
   /lavanet/lava/subscription/estimated_validator_rewards/{validator_address}/10000000000ulava

   # For providers (restaking):
   /lavanet/lava/subscription/estimated_provider_rewards/{provider_address}/10000000000ulava
   ```

2. For each entity:
   - Calculate monthly rewards in USD (including both LAVA and other tokens)
   - This includes IBC token rewards which are converted to USD using CoinGecko prices
   - Convert to annual rate using compound interest formula:
   - `APR = ((1 + monthly_rate) ^ 12 - 1)`

#### Final Calculation

- Both staking and restaking APRs are calculated at the 80th percentile of all values
- Uses benchmark amount of 10,000 LAVA for calculations
- Updates periodically to reflect current network conditions

#### Notes

- APR values represent potential returns before fees and slashing
- Actual returns may vary based on validator/provider performance
- Calculations include all reward types (LAVA + other tokens)
