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
		query_test_health_handler \
		query_test_lavap_provider_error_parsing \
		redis_run \
		redis_restart \
		redis_connect \
		macos_psql_start \
		macos_query_port_pid \
		query_endpoints_full_tests_all

bun_create_migrations:
	bun run generate

bun_build:
	bun run build --verbose

bun_clean_cache:
	bun pm cache rm

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
	IS_INDEXER_PROCESS=true NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

indexer_with_migrations:
	JSINFO_INDEXER_RUN_MIGRATIONS=true NODE_TLS_REJECT_UNAUTHORIZED=0 bun run src/indexer.ts

indexer_with_debugger:
	NODE_TLS_REJECT_UNAUTHORIZED=0 bun --inspect-brk run src/indexer.ts

query:
	npx --yes nodemon --watch src --ext ts --exec "JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts"

query_no_nodemon:
	JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/query.ts

query_inspect:
	NODE_ENV=development JSINFO_QUERY_MEMORY_DEBUG_MODE=true JSINFO_QUERY_IS_DEBUG_MODE=true bun --inspect run src/query.ts --expose-gc

query_memory_debug:
	JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE=true JSINFO_QUERY_MEMORY_DEBUG_MODE=true make query

query_port8090:
	JSINFO_QUERY_PORT=8090 make query

query_test_lavap_prodiver_error_parsing:
	bun run ./src/query/utils/lavapProvidersErrorParser.test.ts 

redis_run:
	docker rm -f redis-stack || true
	docker run --name redis-stack -p 6379:6379 -p 8001:8001 -e REDIS_ARGS="--requirepass mypassword" redis/redis-stack:latest

redis_connect:
	docker exec -it redis-stack redis-cli -a mypassword

macos_psql_start:
	@echo "Checking if PostgreSQL@14 is installed..."
	@if ! brew list postgresql@14 &>/dev/null; then \
		echo "Installing PostgreSQL@14..."; \
		brew install postgresql@14; \
	else \
		echo "PostgreSQL@14 is already installed."; \
	fi
	@echo "Stopping any running PostgreSQL services..."
	-brew services stop postgresql@16
	@echo "Starting PostgreSQL@14 service..."
	brew services start postgresql@14
	@echo "Listing all services..."
	brew services list

macos_kill_query_port:
	@echo "Querying PID for the process on port 8081..."
	@PID=$$(lsof -ti tcp:8081); \
	if [ -n "$$PID" ]; then \
		echo "Killing process $$PID..."; \
		kill $$PID; \
		echo "Process $$PID has been terminated."; \
	else \
		echo "No process found listening on port 8081."; \
	fi

query_endpoints_full_tests_all:
	cd tests/query_endpoints && make query_endpoints_full_tests_all

query_endpoints_full_tests_local:
	cd tests/query_endpoints && make query_endpoints_full_tests_local

query_endpoints_full_tests_staging:
	cd tests/query_endpoints && make query_endpoints_full_tests_staging

query_endpoints_full_tests_testnet:
	cd tests/query_endpoints && make query_endpoints_full_tests_testnet

query_endpoints_full_tests_mainnet:
	cd tests/query_endpoints && make query_endpoints_full_tests_mainnet

executils_getblock:
	JSINFO_QUERY_IS_DEBUG_MODE=true bun run src/executils/getblock.ts 1629704

executils_analyze_heap:
	bun run ./src/executils/analyze-heap.ts

executils_test_rpc:
	bun run ./src/executils/test-rpc.ts

executils_event_debug:
	bun run ./src/executils/event-debug.ts