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
        if echo "$url" | grep -q "Csv"; then
            echo "Received a CSV response." >&2
            echo "$response"
            return
        elif echo "$response" | jq . > /dev/null 2>&1; then
            echo "Received a valid JSON response." >&2
            if [ "$response" != "{}" ]; then
                echo "Response is not empty, returning the response." >&2
                echo "$response"
                return
            else
                echo "Response is an empty JSON object." >&2
            fi
        else
            echo "Received an invalid response." >&2
        fi
        i=$((i+1))
        echo "Sleeping for 0.5 seconds before the next attempt..." >&2
        sleep 0.5
    done
    echo "Exceeded maximum number of retries ($retries), exiting the function." >&2
}

revalidate_cache() {
    echo "revalidate_cache: Starting revalidation of cache..."

    echo "revalidate_cache: Browsing to /cacheLinks"
    response=$(get "/cacheLinks")
    urls=$(echo "$response" | jq -r '.urls[]')

    for url in $urls; do
        echo "revalidate_cache: Browsing to $url"
        get "$url" > /dev/null
    done

    echo "revalidate_cache: Finished revalidation of cache."
}

while true; do
    revalidate_cache
    sleep 30
done