#!/bin/bash

# Endpoint URLs
PROVIDERS_URL="http://localhost:8081/listProviders"
TOTAL_SUPPLY_URL="http://localhost:8081/supply/total"
CIRCULATING_SUPPLY_URL="http://localhost:8081/supply/circulating"

# Initialize a flag to track test success
test_success=0

# Fetch data from /listProviders
providers_response=$(curl -s $PROVIDERS_URL)

# Check for keys in /listProviders response
echo "Checking /listProviders response..."
if echo "$providers_response" | jq '.data | has("providers")'; then
  echo "/listProviders contains all required keys."
else
  echo "/listProviders does not contain all required keys."
  echo "Failed response: $providers_response"
  test_success=1
fi

# Test /supply/total endpoint
echo "Testing /supply/total endpoint..."
total_supply_response=$(curl -s $TOTAL_SUPPLY_URL)
if [[ $total_supply_response =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "/supply/total response is valid: $total_supply_response"
else
  echo "/supply/total response is invalid: $total_supply_response"
  test_success=1
fi

# Test /supply/circulating endpoint
echo "Testing /supply/circulating endpoint..."
circulating_supply_response=$(curl -s $CIRCULATING_SUPPLY_URL)
if [[ $circulating_supply_response =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "/supply/circulating response is valid: $circulating_supply_response"
else
  echo "/supply/circulating response is invalid: $circulating_supply_response"
  test_success=1
fi

# Return 1 if any test failed
exit $test_success