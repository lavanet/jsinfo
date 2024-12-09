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

#### `/validators`

Returns list of all validators

### Example Response

```json
{
  "height": 2200221,
  "datetime": 1710371763,
  "validators": [
    {
      "address": "lava@valoper1qtjgjmc7w9tfem4dn8epzehfp4axk927gphyze",
      "moniker": "P-ops Team",
      "jailed": false,
      "tokens": "9850500000",
      "commission": {
        "commission_rates": {
          "rate": "0.1",
          "max_rate": "0.2",
          "max_change_rate": "0.1"
        },
        "update_time": "2024-04-03T07:11:45.279828464Z"
      }
    }
  ]
}
```

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

## APR (Annual Percentage Rewards) Endpoint

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

#### `/all_providers_apr`

This endpoint returns a list of all providers along with their APR, commission rates, and other relevant information.

### Response Format

The response is a JSON array of objects, where each object contains the following fields:

```json
[
  {
    "address": "string", // The address of the provider
    "moniker": "string", // The display name of the provider (moniker)
    "apr": "string" or "-" // The APR value as a string (percentage) or "-" if not available
    "commission": "string" or "-" // The commission rate as a string (formatted percentage) or "-" if not available
    "30_days_cu_served": "string" or "-" // The cumulative units served in the last 30 days as a string or "-" if not available
    "rewards": "array" or "-" // An array of rewards or "-" if no rewards
  }
]
```

### Example Response

```json
[
  {
    "address": "lava@1gnkhmyhfd4vf03zwwczw2j4wmpckq5wgv2eugv",
    "moniker": "-",
    "apr": "-",
    "commission": "100.0%",
    "30_days_cu_served": "-",
    "rewards": "-"
  },
  {
    "address": "lava@1gpl2h7wwnwmzcxmlmg95rn2pr2m6epddg0ede4",
    "moniker": "DTEAM",
    "apr": "0.0115%",
    "commission": "50.0%",
    "30_days_cu_served": "158635270",
    "rewards": [{ "denom": "lava", "amount": "0.096037" }]
  }
]
```

#### `/apr_full`

Returns detailed APR data for all validators and providers, organized by type.

### Response Format

```json
{
  "Staking APR": {
    "lava@valoper123...": "0.011864706092812094",
    "lava@valoper456...": "0.011004189515468221"
  },
  "Restaking APR": {
    "lava@123...": "0.027668187650690124",
    "lava@456...": "0.22038662837640222"
  }
}
```

# Total Value Locked (TVL) API

## Overview

The Total Value Locked (TVL) API provides an endpoint to retrieve the total value of Lava tokens locked across various platforms.

#### `/total_value_locked`

#### Description

This endpoint returns the total value locked in Lava tokens, calculated as the sum of:

- Locked in staking
- Locked in Reward Pools
- Locked in purchased subscriptions
- Value locked in Dexes (Osmosis, Arbitrum, Base)

### Example Response

```json
{
  "tvl": "203777529975416" // Example total value locked in Lava tokens
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
   - Convert to annual rate using compound interest formula:`APR = ((1 + monthly_rate) ^ 12 - 1)`

#### Final Calculation

- Both staking and restaking APRs are calculated at the 80th percentile of all values
- Uses benchmark amount of 10,000 LAVA for calculations
- Updates periodically to reflect current network conditions

#### Notes

- APR values represent potential returns before fees and slashing
- Actual returns may vary based on validator/provider performance
- Calculations include all reward types (LAVA + other tokens)
