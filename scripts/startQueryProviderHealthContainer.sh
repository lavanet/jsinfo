#!/bin/sh

# jsinfo/scripts/startQueryProviderHealthContainer.sh

echo "Starting query - populate container at $(date)"

# Set traps
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal, ignoring"' 2 15;
ulimit -c unlimited

# this is a must since the list of providers comes from here
echo "QueryPod $(date) :: Sleeping 1 minute before starting the first script..."
sleep 60

# Run the first script in an endless loop
while true; do
    echo "QueryPod $(date) probe1 :: Starting 'python3 lavapProviderHealth/run.py'..."
    timeout 2h python3 -u lavapProviderHealth/run.py 2>&1 || true
    echo "QueryPod $(date) probe1 :: 'python3 lavapProviderHealth/run.py' stopped, restarting..."
done &

# Wait for all child processes to finish
wait