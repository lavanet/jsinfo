#!/bin/sh

# jsinfo/scripts/refreshQueryCache.sh

REST_URL="${REST_URL:-http://0.0.0.0:8080}"

get() {
    url="$1"
    retries=5
    response=""
    echo "revalidate_cache: calling get on $REST_URL$url" >&2
    i=0
    while [ $i -lt $retries ]; do
        echo "Attempt number: $((i+1))" >&2
        response=$(curl -s -m 120 "$REST_URL$url")
        if echo "$response" | jq . > /dev/null 2>&1; then
            echo "Received a valid JSON response." >&2
            if [ "$response" != "{}" ]; then
                echo "Response is not empty, returning the response." >&2
                echo "$response"
                return
            else
                echo "Response is an empty JSON object." >&2
            fi
        else
            echo "Received an invalid JSON response." >&2
        fi
        i=$((i+1))
        echo "Sleeping for 0.5 seconds before the next attempt..." >&2
        sleep 0.5
    done
    echo "Exceeded maximum number of retries ($retries), exiting the function." >&2
}

revalidate_cache_for_specs() {
    echo "revalidate_cache: Revalidating cache for specs..."
    response=$(get "/specs")
    specs=$(echo "$response" | jq -r '.specs[] | .id')
    for spec in $specs; do
        timeout 120 get "/spec/$spec" > /dev/null
    done
}

revalidate_cache_for_consumers() {
    echo "revalidate_cache: Revalidating cache for consumers..."
    response=$(get "/consumers")
    consumers=$(echo "$response" | jq -r '.consumers[] | .address')
    for consumer in $consumers; do
        timeout 120 get "/consumer/$consumer" > /dev/null
    done
}

revalidate_cache_for_providers() {
    echo "revalidate_cache: Revalidating cache for providers..."
    response=$(get "/providers")
    providers=$(echo "$response" | jq -r '.providers[] | .address')
    for provider in $providers; do
        if [ "$provider" != "null" ]; then
            timeout 120 get "/provider/$provider" > /dev/null
        fi
    done
}

revalidate_cache() {
    echo "revalidate_cache: Starting revalidation of cache..."

    echo "revalidate_cache: Browsing to /events"
    get "/events" > /dev/null
    echo "revalidate_cache: Browsing to /index"
    get "/index" > /dev/null

    echo "revalidate_cache: Browsing to /events"
    get "/events" > /dev/null
    echo "revalidate_cache: Browsing to /index"
    get "/index" > /dev/null

    revalidate_cache_for_providers
    revalidate_cache_for_specs
    revalidate_cache_for_consumers

    echo "revalidate_cache: Browsing to /events"
    get "/events" > /dev/null
    echo "revalidate_cache: Browsing to /index"
    get "/index" > /dev/null

    echo "revalidate_cache: Finished revalidation of cache."
}

while true; do
    revalidate_cache
    sleep 30
done