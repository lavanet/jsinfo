#!/bin/bash

# Endpoint URLs
SUPPLY_URL="http://localhost:8081/supply"
PROVIDERS_URL="http://localhost:8081/listProviders"

# Fetch data from /supply
supply_response=$(curl -s $SUPPLY_URL)

# Check for keys in /supply response
echo "Checking /supply response..."
if echo "$supply_response" | jq '. | has("chain_id") and has("total_supply") and has("circulating_supply")'; then
  echo "/supply contains all required keys."
else
  echo "/supply does not contain all required keys."
  echo "Failed response: $supply_response"
fi

# Fetch data from /listProviders
providers_response=$(curl -s $PROVIDERS_URL)

# Check for keys in /listProviders response
echo "Checking /listProviders response..."
if echo "$providers_response" | jq '.data | has("providers")'; then
  echo "/listProviders contains all required keys."
else
  echo "/listProviders does not contain all required keys."
  echo "Failed response: $providers_response"
fi