#!/bin/sh

# jsinfo/scripts/startQueryProviderHealthContainer.sh

echo "Starting query - populate container at $(date)"

# Set traps
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal, ignoring"' 2 15;
ulimit -c unlimited

# Run the first script in an endless loop
while true; do
    echo "QueryPod $(date) probe1 :: Starting 'python3 lavapProviderHealth/run.py'..."
    python3 -u lavapProviderHealth/run.py 2>&1 || true
    echo "QueryPod $(date) probe1 :: 'python3 lavapProviderHealth/run.py' stopped, restarting..."
    sleep 60
done &

# Wait for all child processes to finish
wait