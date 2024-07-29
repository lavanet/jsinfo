#!/bin/bash

# Change directory to the directory where the script is located
cd "$(dirname "$0")"

# Check for mode argument
if [ $# -eq 0 ]; then
  echo "No mode specified. Usage: $0 [local|staging|testnet|mainnet]"
  exit 1
fi

# Set SERVER_ADDRESS based on the mode
case $1 in
  local)
    export SERVER_ADDRESS="http://localhost:8081"
    ;;
  staging)
    export SERVER_ADDRESS="https://jsinfo.lava-cybertron.xyz"
    ;;
  testnet)
    export SERVER_ADDRESS="https://jsinfo.lavanet.xyz"
    ;;
  mainnet)
    export SERVER_ADDRESS="https://jsinfo.mainnet.lavanet.xyz"
    ;;
  *)
    echo "Invalid mode specified. Usage: $0 [local|staging|testnet|mainnet]"
    exit 1
    ;;
esac

echo "Mode: $1"
echo "SERVER_ADDRESS set to $SERVER_ADDRESS"

# Perform a health check by browsing to SERVER_ADDRESS/health and assert the response
HEALTH_CHECK_RESPONSE=$(curl -s "${SERVER_ADDRESS}/health")
if echo "$HEALTH_CHECK_RESPONSE" | grep -q '"health":"ok"'; then
  echo "Health check passed."
else
  echo "Health check failed: $HEALTH_CHECK_RESPONSE"
  exit 1
fi

# Define an array of commands to execute
commands=(
  "./mainnet_endpoints.sh"
  "python3 ajax_endpoints.py"
  "python3 index_page_endpoints.py"
  "python3 index_tabs_endpoints.py"
)

# Loop through the commands and execute them
for cmd in "${commands[@]}"; do
  echo "Executing: $cmd"
  if ! $cmd; then
    echo "Error executing: $cmd"
    exit 1
  fi
done

echo "All commands executed successfully."

