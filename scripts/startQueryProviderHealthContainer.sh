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
    echo "QueryPod $(date) probe1 :: Starting 'python3 lavapProviderHealth/run.py'..."
    JSINFO_LAVAP_LOG_PREFIX="probe1" python3 -u lavapProviderHealth/run.py 2>&1 || true
    echo "QueryPod $(date) probe1 :: 'python3 lavapProviderHealth/run.py' stopped, restarting..."
    sleep 60
done &

echo "QueryPod $(date) :: Sleeping 2 minute before starting the second lavapProviderHealth..."
sleep 120

# Run the first script in an endless loop
while true; do
    echo "QueryPod $(date) probe2 :: Starting 'python3 lavapProviderHealth/run.py'..."
    JSINFO_LAVAP_LOG_PREFIX="probe2" python3 -u lavapProviderHealth/run.py 2>&1 || true
    echo "QueryPod $(date) probe2 :: 'python3 lavapProviderHealth/run.py' stopped, restarting..."
    sleep 120
done &

echo "QueryPod $(date) :: Sleeping 1 minutes before starting the bun server"
sleep 60

# Run the second script in an endless loop
while true; do
    # Generate a random number of minutes between 1 to 4 hours
    BUN_TIMEOUT=$((RANDOM % 181 + 60))

    echo "QueryPod $(date) :: Starting 'env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 bun run src/query.js'... with ${BUN_TIMEOUT} minute timeout"
    env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 timeout ${BUN_TIMEOUT}m bun run src/query.js || true
    echo "QueryPod $(date) :: 'env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 bun run src/query.js' stopped, restarting..."
    sleep 1
done &

# Wait for all child processes to finish
wait