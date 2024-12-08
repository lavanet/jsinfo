#!/bin/sh

# jsinfo/scripts/startIndexerContainer.sh

echo "Starting indexer container at $(date)"

export IS_INDEXER_PROCESS=true;

trap 'echo \"Warning: Script received SIGSEGV, ignoring\"' 11;
trap 'echo \"Error: Script terminated by signal, ignoring\"' 2 15;
ulimit -c unlimited;
while true; do
    # echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting bun dist/src/indexer.js in process_monitor";
    # timeout 4m bun run dist/src/indexer.js;
    python3 -u scripts/process_monitor.py 600 "bun run dist/src/indexer.js" || true;
    EXIT_CODE=$?;
    echo "$(date '+%Y-%m-%d %H:%M:%S') - process_monitor.py bun run dist/src/indexer.js exited with code:" $EXIT_CODE;
    if [ $EXIT_CODE -ne 0 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Error: process_monitor.py bun run dist/src/indexer.js returned a non 0 exit code, restarting...";
    fi;
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Finished process_monitor.py bun run dist/src/indexer.js loop";
    # sleep 1;
done