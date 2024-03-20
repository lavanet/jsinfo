#!/bin/sh

# jsinfo/scripts/startQueryProviderHealthContainer.sh

echo "Starting query - populate container at $(date)"

# Set traps
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal"; exit' 2 15;
ulimit -c unlimited

echo "QueryPod $(date) :: Sleeping 1 minute before starting the first script..."
sleep 60

# Run the first script in an endless loop
while true; do
    echo "QueryPod $(date) :: Starting 'python3 lavapProviderHealth/run.py'..."
    python3 -u lavapProviderHealth/run.py 2>&1 || true
    echo "QueryPod $(date) :: 'python3 lavapProviderHealth/run.py' stopped, restarting..."
    sleep 1
done &

echo "QueryPod $(date) :: Sleeping 1 minute before starting the second script..."
sleep 60

# Run the second script in an endless loop
while true; do
    # Generate a random number of minutes between 120 and 180
    BUN_TIMEOUT=$((RANDOM % 61 + 120))

    echo "QueryPod $(date) :: Starting 'env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 bun run src/query.js'... with ${BUN_TIMEOUT} minute timeout"
    env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 timeout ${BUN_TIMEOUT}m bun run src/query.js || true
    echo "QueryPod $(date) :: 'env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 bun run src/query.js' stopped, restarting..."
    sleep 1
done &

# Wait for all child processes to finish
sleep