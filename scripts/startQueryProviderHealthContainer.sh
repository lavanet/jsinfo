#!/bin/sh

# jsinfo/scripts/startQueryProviderHealthContainer.sh

echo "Starting query - populate container at $(date)"

# Set traps
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal, ignoring"' 2 15;

# Run the first script in an endless loop
while true; do
    echo "QueryPod $(date) :: Starting 'python3 lavapProviderHealth/run.py'..."
    timeout 2h python3 -u lavapProviderHealth/run.py 2>&1 || true
    echo "QueryPod $(date) :: 'python3 lavapProviderHealth/run.py' stopped, restarting..."
done
