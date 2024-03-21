.PHONY: build_bun_docker connect_to_bun_docker run_docker_compose indexer query

build_bun_docker:
	docker build --progress=plain -t bun-docker .

connect_to_bun_docker:
	docker run --privileged -it bun-docker /bin/sh

run_docker_compose:
	docker-compose -f docker-compose.yml up

run_docker_compose_query_populate:
	docker-compose up query_populate

run_docker_compose_query:
	docker-compose up query

run_docker_compose_indexer:
	docker-compose up indexer

run_indexer:
	NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

# run_indexer_even:
# 	JSINFO_INDEXER_BLOCK_TYPE=even NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

# run_indexer_odd:
# 	JSINFO_INDEXER_BLOCK_TYPE=odd NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

run_query:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts

run_query_nodemon:
	npx nodemon --watch src --ext ts --exec "JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

run_query_nodemon_no_cache:
	npx nodemon --watch src --ext ts --exec "JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

run_query_populate_mode:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true JSINFO_QUERY_CACHE_POPULTAE_MODE=true bun run src/query.ts

run_query_no_cache_local_debug:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true JSINFO_QUERY_CACHE_ENABLED=false bun run src/query.ts

run_lavapProviderHealth:
	cd lavapProviderHealth && python run.py

create_migrations:
	bun run generate

bun_query_health_handeler_test:
	bun test providerHealthHandler.test.ts 