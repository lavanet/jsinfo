#!/bin/bash

# Change directory to the directory where the script is located
cd "$(dirname "$0")"

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