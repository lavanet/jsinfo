#!/bin/bash

# Change directory to the directory where the script is located
cd "$(dirname "$0")"

# Check for mode argument
if [ $# -eq 0 ]; then
  echo "No mode specified. Usage: $0 [local|staging|testnet|mainnet]"
  exit 1
fi

# Store the mode in TESTS_ENV
export TESTS_ENV=$1

# Source env.sh if it exists
if [ -f "./env.sh" ]; then
  source ./env.sh
else
  echo "env.sh not found. run cp env.sh.example env.sh ."
  exit 1
fi

# Set TESTS_SERVER_ADDRESS based on the mode
case $TESTS_ENV in
  local)
    export TESTS_SERVER_ADDRESS=${TESTS_SERVER_ADDRESS_LOCAL:-"http://localhost:8081"}
    ;;
  staging)
    export TESTS_SERVER_ADDRESS=${TESTS_SERVER_ADDRESS_STAGING}
    ;;
  testnet)
    export TESTS_SERVER_ADDRESS=${TESTS_SERVER_ADDRESS_TESTNET}
    ;;
  mainnet)
    export TESTS_SERVER_ADDRESS=${TESTS_SERVER_ADDRESS_MAINNET}
    ;;
  *)
    echo "Invalid mode specified. Usage: $0 [local|staging|testnet|mainnet]"
    exit 1
    ;;
esac

echo "TESTS_ENV: $TESTS_ENV"

# removed until further notice
# # Perform a health check by browsing to TESTS_SERVER_ADDRESS/health and assert the response
# HEALTH_CHECK_RESPONSE=$(curl -s "${TESTS_SERVER_ADDRESS}/health")
# if echo "$HEALTH_CHECK_RESPONSE" | grep -q '"health":"ok"'; then
#   echo "Health check passed."
# else
#   echo "Health check failed: $HEALTH_CHECK_RESPONSE"
#   exit 1
# fi

# Define an array of commands to execute
commands=(
  "./tests/mainnet_endpoints.sh"
  "python3 ./tests/ajax_endpoints.py"

  "python3 ./tests/index_page_endpoints.py"

  # TESTS_FULL tests:
  "python3 ./tests/provider_page_endpoints.py"
  "python3 ./tests/provider_tabs_endpoints.py"
  "python3 ./tests/provider_csv_endpoints.py"

  "python3 ./tests/consumer_page_endpoints.py"

  "python3 ./tests/events_page_endpoints.py"
  "python3 ./tests/events_csv_endpoints.py"

  "python3 ./tests/spec_page_endpoints.py"
  "python3 ./tests/spec_providerhealth_endpoint.py"

  "python3 ./tests/lava_iprpc_endpoint.py"
)

# Loop through the commands and execute them
for cmd in "${commands[@]}"; do
  echo "TESTS:: Environment: $TESTS_ENV, Full Tests: $TESTS_FULL, Time: $(date)"
  echo "TESTS:: Executing: $cmd"
  if ! $cmd; then
    echo "Error executing: $cmd"
    exit 1
  fi
done

echo "All tests executed successfully."

