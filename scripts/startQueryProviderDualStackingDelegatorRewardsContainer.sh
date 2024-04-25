#!/bin/sh

# jsinfo/scripts/startQueryProviderDualStackingDelegatorRewardsContainer.sh

echo "Starting query - populate container at $(date)"

# Set traps
trap 'echo "Warning: Script received SIGSEGV, ignoring"' 11;
trap 'echo "Error: Script terminated by signal, ignoring"' 2 15;
ulimit -c unlimited

export JSINFO_QUERY_PORT=8090 

echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Killing bun"
ps aux | grep 'bun' | grep -v grep | grep -vi system | grep -vi library | grep -vi coreservices | grep -v grep | awk '{print $2}' | xargs kill -9

# Check if the node URL is undefined, and set default if necessary
: ${JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL:="https://public-rpc.lavanet.xyz:443"}

# Check if QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CONTAINER_DEBUG is set and not empty
if [ -n "$QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CONTAINER_DEBUG" ]; then
    CMD="bun run src/query.ts"
    DEBUG_MODE="true"
else
    CMD="bun run src/query.js"
    DEBUG_MODE="false"
fi

# Run the second script in an endless loop
while true; do
    # Generate a random number of minutes between 1 to 4 hours
    BUN_TIMEOUT=$((RANDOM % 181 + 60))

    echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Starting 'env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=$JSINFO_QUERY_PORT JSINFO_QUERY_IS_DEBUG_MODE=$DEBUG_MODE $CMD'... with ${BUN_TIMEOUT} minute timeout"
    env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=$JSINFO_QUERY_PORT JSINFO_QUERY_IS_DEBUG_MODE=$DEBUG_MODE timeout ${BUN_TIMEOUT}m $CMD || true
    echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: 'env JSINFO_QUERY_CACHE_POPULTAE_MODE=true JSINFO_QUERY_PORT=$JSINFO_QUERY_PORT JSINFO_QUERY_IS_DEBUG_MODE=$DEBUG_MODE $CMD' stopped, restarting..."
    sleep 1
done &

echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Sleeping 5 seconds before starting the probe with rpc: ${JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL}"
sleep 5

# Infinite loop to fetch and post rewards continuously
while true; do
    echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Fetching the list of providers..."
    providers=$(curl -s "http://localhost:$JSINFO_QUERY_PORT/providers" | jq -r '.providers[].address')

    for provider in $providers; do
        echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Fetching dual stacking delegator rewards for provider $provider..."
        echo lavad q dualstaking delegator-rewards $provider --node $JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL --output json

        while true; do
            rewards=$(lavad q dualstaking delegator-rewards $provider --node $JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL --output json 2>&1)
            if [[ $rewards != *"Error: error in json rpc client"* ]]; then
                break
            fi
            echo "Error occurred, retrying..."
            sleep 1
        done

        rewards_json=$(echo $rewards | jq '.')
        if [ $? -eq 0 ]; then
            rewards_length=$(echo $rewards_json | jq '.rewards | length')
            if [ $? -eq 0 ]; then
                if [ "$rewards_length" -ne 0 ]; then
                    echo $rewards > temp.json
                    echo "Rewards fetched for provider $provider:"
                    cat temp.json
                    echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Posting rewards to the API endpoint for provider $provider..."
                    curl -X POST http://localhost:$JSINFO_QUERY_PORT/lavapDualStackingDelegatorRewards -H 'Content-Type: application/json' -d @temp.json
                    echo
                    rm temp.json
                fi
            fi
        fi
    done

    # Longer sleep at the end of each complete cycle to mitigate server load and API call frequency
    echo "QueryProviderDualStackingDelegatorRewardsPod $(date) :: Completed one cycle of fetching and posting, sleeping before the next cycle..."
    sleep 1h
done &

# Wait for all child processes to finish
wait
