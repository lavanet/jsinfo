.PHONY: bun_create_migrations \
        docker_build \
        docker_sh \
        docker_compose \
        docker_compose_query_populate \
        docker_compose_query \
        docker_compose_indexer \
        indexer \
        indexer_debug_events \
        query \
        query_nodemon \
        query_populate_mode \
        query_no_cache \
        run_lavapProviderHealth \
        query_test_health_handler \
        query_test_lavap_provider_error_parsing \
        scripts_local_startQueryProviderDualStackingDelegatorRewardsContainer \
        redis_run \
        redis_connect \
        macos_psql_start \
        macos_query_port_pid \
        query_endpoints_tests_local \
        query_endpoints_tests_staging \
        query_endpoints_tests_testnet \
        query_endpoints_tests_mainnet \
        query_endpoints_full_tests_local \
        query_endpoints_full_tests_staging \
        query_endpoints_full_tests_testnet \
        query_endpoints_full_tests_mainnet

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

indexer_with_migrations:
	JSINFO_INDEXER_RUN_MIGRATIONS=true NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

indexer_with_debugger:
	NODE_TLS_REJECT_UNAUTHORIZED=0 bun --inspect-brk run src/indexer.ts

indexer_debug_events:
	JSINFO_INDEXER_DEBUG_DUMP_EVENTS=true NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

query:
	npx nodemon --watch src --ext ts --exec "JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

query_no_nodemon:
	JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts

query_port8090:
	JSINFO_QUERY_PORT=8090 make query

query_test_lavap_prodiver_error_parsing:
	bun run ./src/query/utils/lavapProvidersErrorParser.test.ts 

query_endpoints_tests_local:
	@echo "Running query endpoints tests on local environment..."
	./tests/query_endpoints/tests.sh local

query_endpoints_tests_staging:
	@echo "Running query endpoints tests on staging environment..."
	./tests/query_endpoints/tests.sh staging

query_endpoints_tests_testnet:
	@echo "Running query endpoints tests on testnet environment..."
	./tests/query_endpoints/tests.sh testnet

query_endpoints_tests_mainnet:
	@echo "Running query endpoints tests on mainnet environment..."
	./tests/query_endpoints/tests.sh mainnet

query_endpoints_tests_all: query_endpoints_tests_staging query_endpoints_tests_testnet query_endpoints_tests_mainnet

query_endpoints_full_tests_local:
	@echo "Running full query endpoints tests on local environment..."
	TESTS_FULL=true ./tests/query_endpoints/tests.sh local

query_endpoints_full_tests_staging:
	@echo "Running full query endpoints tests on staging environment..."
	TESTS_FULL=true ./tests/query_endpoints/tests.sh staging

query_endpoints_full_tests_testnet:
	@echo "Running full query endpoints tests on testnet environment..."
	TESTS_FULL=true ./tests/query_endpoints/tests.sh testnet

query_endpoints_full_tests_mainnet:
	@echo "Running full query endpoints tests on mainnet environment..."
	TESTS_FULL=true ./tests/query_endpoints/tests.sh mainnet

query_endpoints_full_tests_all: query_endpoints_full_tests_staging query_endpoints_full_tests_testnet query_endpoints_full_tests_mainnet

run_lavapProviderHealth:
	cd lavapProviderHealth && python run.py

scripts_local_startQueryProviderDualStackingDelegatorRewardsContainer:
	QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CONTAINER_DEBUG=true bash scripts/startQueryProviderDualStackingDelegatorRewardsContainer.sh

redis_run:
	docker run -d --name redis-stack -p 6379:6379 -p 8001:8001 -e REDIS_ARGS="--requirepass mypassword" redis/redis-stack:latest

redis_connect:
	docker exec -it redis-stack redis-cli

macos_psql_start:
	brew services start postgresql; brew services list

macos_query_port_pid:
	lsof -i tcp:8081 -sTCP:LISTEN