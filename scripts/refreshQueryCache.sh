#!/bin/sh

# jsinfo/scripts/refreshQueryCache.sh

scripts/refreshQueryCache.sh

get() {
    url="$1"
    timeout 120 ./scripts/refreshQueryCacheGet.sh "$url"
}

revalidate_cache_for_specs() {
    echo "revalidate_cache: Revalidating cache for specs..."
    response=$(get "/specs")
    specs=$(echo "$response" | jq -r '.specs[] | .id')
    for spec in $specs; do
        get "/spec/$spec" > /dev/null
    done
}

revalidate_cache_for_consumers() {
    echo "revalidate_cache: Revalidating cache for consumers..."
    response=$(get "/consumers")
    consumers=$(echo "$response" | jq -r '.consumers[] | .address')
    for consumer in $consumers; do
        get "/consumer/$consumer" > /dev/null
    done
}

revalidate_cache_for_providers() {
    echo "revalidate_cache: Revalidating cache for providers..."
    response=$(get "/providers")
    providers=$(echo "$response" | jq -r '.providers[] | .address')
    for provider in $providers; do
        if [ "$provider" != "null" ]; then
            get "/provider/$provider" > /dev/null
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