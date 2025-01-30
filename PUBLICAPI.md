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
- And for each stake - the stakestatus (active/frozen/jailed)

#### `/providers`

Returns list of all providers (addresses only)

#### `/active_providers`

Returns list of all active providers (addresses only)

#### `/consumers`

Returns list of all consumers (addresses only)

#### `/specs`

Returns list of all specs/chains (spec names only)

#### `/validators`

Returns list of all validators (full info)

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

#### `/active_validators`

Returns list of all active validators (addresses only)

## Supply Endpoints

#### `/supply/circulating`

- Returns the current circulating supply of LAVA tokens in LAVA denomination as a plain text number string

#### `/supply/total`

- Returns the total supply of LAVA tokens

## Chain Wallet Statistics

#### `/lava_chain_stakers`

#### `/lava_chain_restakers`

- Returns current and monthly unique staker counts
- only delegation of active providers are taken into account
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

   - Represent unique users over 30-day period back from today
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

#### `/all_providers_apr` / `/providers_performance`

This endpoint returns a list of all providers along with their APR, commission rates, rewards, and specifications.

### Response Format

```json
[
  {
    "address": "lava@16gjdwqfpvk3dyasy83wsr26pk27kjq9wvfz0qy", // Provider's lava address
    "moniker": "Protofire DAO", // Provider's display name
    "avatar": <todo>
    "apr": "43.1998%", // APR as percentage
    "commission": "50.0%", // The commision set by the provider
    "30_days_cu_served": "220504230", // Compute units served in last 30 days
    "30_days_relays_served": "12476269", // Number of relays served in last 30 days
    "rewards_10k_lava_delegation": [
    // Monthly estimated rewards for a 10,000 LAVA delegation
     {
        "denom": "usdc", // Token denomination
        "amount": "35.230493" // Token amount
      },
      {
        "denom": "lava",
        "amount": "6.558887"
      }
    ],
    "rewards_last_month": [
      // [same as on the rewards website](https://rewards.lavanet.xyz/provider_rewards)
      // but return spec to
      {
        "chain": "Lava Mainnet",
        "spec": "LAVA",
        "tokens": [
          {
            "amount": "15551928.000000000000000000",
            "denom": "lava",
            "original_denom": "ulava",
            "value_usd": "$1.85"
          },
        ],
        "total_usd": 1.848455506296
      },
    ],
    "specs": [
      // Array of chain specifications as returned by the listProviders api
      {
        "chain": "lava mainnet", // Chain name
        "spec": "LAVA", // Specification identifier
        "stakestatus": "Active", // Status (Active/Frozen/Jailed)
        "stake": "4850000000", // Staked amount
        "addons": "", // Provider addons
        "extensions": "", // Provider extensions
        "delegateCommission": "50", // Delegation commission
        "delegateTotal": "94912424429", // Total delegations
        "moniker": "Protofire DAO" // Provider name for this spec
        "icon": "url" ...
      },
      {
        "chain": "fvm mainnet",
        "spec": "FVM",
        "stakestatus": "Active",
        "stake": "5000000000",
        "addons": "",
        "extensions": "archive",
        "delegateCommission": "50",
        "delegateTotal": "97847860237",
        "moniker": "Protofire DAO"
      }
    ],
    "stake": "4850000000", // Provider's stake amount
    "stakestatus": "Active", // Provider's status
    "addons": "", // Provider's addons
    "extensions": "", // Provider's extensions
    "delegateTotal": "94912424429" // Total delegations
  }
]
```

All string fields will return "-" if the data is not available.

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
- APR calculation only considers active validators/providers (not jailed or frozen)

### Example Response

```json
[
  {
    "address": "lava@16gjdwqfpvk3dyasy83wsr26pk27kjq9wvfz0qy",
    "moniker": "Protofire DAO",
    "apr": "43.1998%",
    "commission": "50.0%",
    "30_days_cu_served": "220504230",
    "30_days_relays_served": "12476269",
    "rewards": [
      {
        "denom": "usdc",
        "amount": "35.230493"
      },
      {
        "denom": "lava",
        "amount": "6.558887"
      }
    ],
    "specs": [
      {
        "chain": "lava mainnet",
        "spec": "LAVA",
        "stakestatus": "Active",
        "stake": "4850000000",
        "addons": "",
        "extensions": "",
        "delegateCommission": "50",
        "delegateTotal": "94912424429",
        "moniker": "Protofire DAO"
      },
      {
        "chain": "fvm mainnet",
        "spec": "FVM",
        "stakestatus": "Active",
        "stake": "5000000000",
        "addons": "",
        "extensions": "archive",
        "delegateCommission": "50",
        "delegateTotal": "97847860237",
        "moniker": "Protofire DAO"
      }
    ],
    "stake": "4850000000",
    "stakestatus": "Active",
    "addons": "",
    "extensions": "",
    "delegateTotal": "94912424429"
  }
]
```

All string fields will return "-" if the data is not available.
