.PHONY: build_bun_docker connect_to_bun_docker docker_compose indexer query

build_bun_docker:
	docker build --progress=plain -t bun-docker .

connect_to_bun_docker:
	docker run --privileged -it bun-docker /bin/sh

docker_compose:
	docker-compose -f docker-compose.yml up

docker_compose_query_populate:
	docker-compose up query_populate

docker_compose_query:
	docker-compose up query

docker_compose_indexer:
	docker-compose up indexer

indexer:
	NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

indexer_debug_events:
	JSINFO_INDEXER_DEBUG_DUMP_EVENTS=true NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

query:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts

query_nodemon:
	npx nodemon --watch src --ext ts --exec "JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

query_nodemon_no_cache:
	npx nodemon --watch src --ext ts --exec "JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

query_populate_mode:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true JSINFO_QUERY_CACHE_POPULTAE_MODE=true bun run src/query.ts

query_no_cache_local_debug:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true JSINFO_QUERY_CACHE_ENABLED=false bun run src/query.ts

run_lavapProviderHealth:
	cd lavapProviderHealth && python run.py

create_migrations:
	bun run generate

query_test_health_handeler:
	bun test providerHealthHandler.test.ts 

query_teset_lavap_prodiver_error_parsing:
	bun run ./src/query/utils/lavapProvidersErrorParser.test.ts 