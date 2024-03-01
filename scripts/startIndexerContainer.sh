#!/bin/sh

# jsinfo/scripts/startIndexerContainer.sh

echo "Starting indexer container at $(date)"

trap 'echo \"Warning: Script received SIGSEGV, ignoring\"' 11;
trap 'echo \"Error: Script terminated by signal\"; exit' 2 15;
ulimit -c unlimited;
while true; do
    echo 'Starting bun src/indexer.js in process_monitor at:' $(date);
    python3 -u scripts/process_monitor.py 600 "bun run src/indexer.js"
    EXIT_CODE=$?;
    echo 'process_monitor.py bun run src/indexer.js exited with code:' $EXIT_CODE;
    if [ $EXIT_CODE -ne 0 ]; then
        echo 'Error: process_monitor.py bun run src/indexer.js returned a non 0 exit code, restarting...';
    fi;
    echo 'Finished process_monitor.py bun run src/indexer.js loop at:' $(date);
    sleep 1;
done