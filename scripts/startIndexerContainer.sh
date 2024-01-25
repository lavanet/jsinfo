#!/bin/sh

# jsinfo/scripts/startIndexerContainer.sh

echo "Starting indexer container at $(date)"

trap 'echo \"Warning: Script received SIGSEGV, ignoring\"' 11;
trap 'echo \"Error: Script terminated by signal\"; exit' 2 15;
ulimit -c unlimited;
while true; do
    echo 'Starting bun src/indexer.js at:' $(date);
    bun run src/indexer.js;
    EXIT_CODE=$?;
    echo 'bun run src/indexer.js exited with code:' $EXIT_CODE;
    if [ $EXIT_CODE -ne 0 ]; then
        echo 'Error: bun run src/indexer.js failed';
    fi;
    echo 'Finished bun run src/indexer.js at:' $(date);
    sleep 1;
done