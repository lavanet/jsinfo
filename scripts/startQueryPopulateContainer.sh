#!/bin/sh

# jsinfo/scripts/startQueryPopulateContainer.sh

echo "Starting query - populate container at $(date)"

# Set traps and unlimited core dump size
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal"; exit' 2 15;
ulimit -c unlimited

# Start the scripts in an endless loop
run_script() {
    command=$1
    while true; do
        echo "QueryPod $(date) :: Starting '$command'..."
        eval "$command" || true
        echo "QueryPod $(date) :: '$command' stopped, restarting..."
        sleep 1
    done
}

# Start the scripts in the background
run_script "env REST_URL=http://0.0.0.0:8081 sh scripts/refreshQueryCache.sh" &
run_script "env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=8081 bun run src/query.js" &

# Wait for all child processes to finish
wait