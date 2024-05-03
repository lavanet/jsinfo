#!/bin/sh

# jsinfo/scripts/refreshQueryCache.sh

REST_URL="${REST_URL:-http://0.0.0.0:8080}"
LOG_PREFIX="${LOG_PREFIX:-}"

log() {
    echo "$(date) $LOG_PREFIX: $1 $REST_URL$url" >&2
}

get() {
    url="$1"
    retries=5
    response=""
    log "revalidate_cache: calling get on"
    i=0
    while [ $i -lt $retries ]; do
        log "Attempt number: $((i+1))"
        response=$(curl -s -m 120 "$REST_URL$url")
        if echo "$url" | grep -q "Csv"; then
            log "Received a CSV response."
            echo "$response"
            return
        elif echo "$response" | jq . > /dev/null 2>&1; then
            log "Received a valid JSON response."
            if [ "$response" != "{}" ]; then
                log "Response is not empty, returning the response."
                echo "$response"
                return
            else
                log "Response is an empty JSON object."
            fi
        else
            log "Received an invalid response."
        fi
        i=$((i+1))
        log "Sleeping for 0.5 seconds before the next attempt..."
        sleep 0.5
    done
    log "Exceeded maximum number of retries ($retries), exiting the function."
}

revalidate_cache() {
    log "revalidate_cache: Starting revalidation of cache..."

    log "revalidate_cache: Browsing to /cacheLinks"
    response=$(get "/cacheLinks")
    urls=$(echo "$response" | jq -r '.urls[]')

    for url in $urls; do
        log "revalidate_cache: Browsing to"
        get "$url" > /dev/null
        sleep 0.1
    done

    log "revalidate_cache: Finished revalidation of cache."
}

while true; do
    revalidate_cache
    sleep 30
done