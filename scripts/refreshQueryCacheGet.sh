#!/bin/sh

# jsinfo/scripts/refreshQueryCacheGet.sh

REST_URL="${REST_URL:-http://0.0.0.0:8080}"

get() {
    url="$1"
    retries=5
    response=""
    echo "revalidate_cache: calling get on $REST_URL$url" >&2
    i=0
    while [ $i -lt $retries ]; do
        response=$(curl -s -m 120 "$REST_URL$url")
        if echo "$response" | jq . > /dev/null 2>&1; then
            if [ "$response" != "{}" ]; then
                echo "$response"
                return
            fi
        fi
        i=$((i+1))
        sleep 0.5
    done
}

get "$1"