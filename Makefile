.PHONY: bun_create_migrations docker_build docker_sh docker_compose docker_compose_query_populate docker_compose_query docker_compose_indexer indexer indexer_debug_events query query_nodemon query_populate_mode query_no_cache run_lavapProviderHealth query_test_health_handeler query_teset_lavap_prodiver_error_parsing scripts_local_startQueryProviderDualStackingDelegatorRewardsContainer

bun_create_migrations:
	bun run generate

bun_build:
	bun run build --verbose

docker_build:
	docker build --progress=plain -t bun-docker .

docker_sh:
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
	npx nodemon --watch src --ext ts --exec "JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

query_no_nodemon:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts

query_port8090:
	JSINFO_QUERY_PORT=8090 make query

query_populate_mode:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true JSINFO_QUERY_CACHE_POPULTAE_MODE=true bun run src/query.ts

query_no_cache:
	JSINFO_QUERY_CLEAR_DISKCACHE_ON_START=true JSINFO_QUERY_IS_DEBUG_MODE=true JSINFO_QUERY_CACHE_ENABLED=false bun run src/query.ts

run_lavapProviderHealth:
	cd lavapProviderHealth && python run.py

query_test_health_handeler:
	bun test providerHealthHandler.test.ts 

query_test_lavap_prodiver_error_parsing:
	bun run ./src/query/utils/lavapProvidersErrorParser.test.ts 

scripts_local_startQueryProviderDualStackingDelegatorRewardsContainer:
	QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CONTAINER_DEBUG=true bash scripts/startQueryProviderDualStackingDelegatorRewardsContainer.sh