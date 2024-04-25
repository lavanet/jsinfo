#!/bin/sh

# jsinfo/scripts/startQueryContainer.sh

echo "Starting query - webserver container at $(date)"

# Set traps and unlimited core dump size
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal, ignoring"' 2 15;
ulimit -c unlimited

# Start the scripts in an endless loop
run_script() {
    command=$1
    while true; do
        # Generate a random number between 1 to 4 hours
        BUN_TIMEOUT=$((RANDOM % 181 + 60))
        
        # Run the command with the random timeout
        echo "QueryPod $(date) :: Starting '$command' with ${BUN_TIMEOUT} minute timeout ..."
        eval "timeout ${BUN_TIMEOUT}m $command" || true
        echo "QueryPod $(date) :: '$command' stopped, restarting..."
        sleep 1
    done
}

# Start the scripts in the background
run_script "env JSINFO_QUERY_CACHE_POPULTAE_MODE=false bun run src/query.js" &

# Wait for all child processes to finish
wait