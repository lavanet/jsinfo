#!/bin/sh

# jsinfo/scripts/startIndexerContainer.sh

echo "Starting indexer container at $(date)"

trap 'echo \"Warning: Script received SIGSEGV, ignoring\"' 11;
trap 'echo \"Error: Script terminated by signal\"; exit' 2 15;
ulimit -c unlimited;
while true; do
    echo 'Starting bun src/indexer.ts at:' $(date);
    npx tsx src/indexer.ts;
    EXIT_CODE=$?;
    echo 'npx tsx src/indexer.ts exited with code:' $EXIT_CODE;
    if [ $EXIT_CODE -ne 0 ]; then
        echo 'Error: npx tsx src/indexer.ts failed';
    fi;
    echo 'Finished npx tsx src/indexer.ts at:' $(date);
    sleep 1;
done