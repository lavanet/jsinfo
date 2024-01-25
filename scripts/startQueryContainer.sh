#!/bin/sh

# jsinfo/scripts/startQueryContainer.sh

echo "Starting query - webserver container at $(date)"

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
run_script "bun run src/query.js" &

# Wait for all child processes to finish
wait