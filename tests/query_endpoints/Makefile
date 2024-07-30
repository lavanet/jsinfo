.PHONY: query_endpoints_tests_local \
        query_endpoints_tests_staging \
        query_endpoints_tests_testnet \
        query_endpoints_tests_mainnet \
        query_endpoints_full_tests_local \
        query_endpoints_full_tests_staging \
        query_endpoints_full_tests_testnet \
        query_endpoints_full_tests_mainnet

query_endpoints_tests_local:
	@echo "Running query endpoints tests on local environment..."
	./tests.sh local

query_endpoints_tests_staging:
	@echo "Running query endpoints tests on staging environment..."
	./tests.sh staging

query_endpoints_tests_testnet:
	@echo "Running query endpoints tests on testnet environment..."
	./tests.sh testnet

query_endpoints_tests_mainnet:
	@echo "Running query endpoints tests on mainnet environment..."
	./tests.sh mainnet

query_endpoints_tests_all: query_endpoints_tests_staging query_endpoints_tests_testnet query_endpoints_tests_mainnet

query_endpoints_full_tests_local:
	@echo "Running full query endpoints tests on local environment..."
	TESTS_FULL=true ./tests.sh local

query_endpoints_full_tests_staging:
	@echo "Running full query endpoints tests on staging environment..."
	TESTS_FULL=true ./tests.sh staging

query_endpoints_full_tests_testnet:
	@echo "Running full query endpoints tests on testnet environment..."
	TESTS_FULL=true ./tests.sh testnet

query_endpoints_full_tests_mainnet:
	@echo "Running full query endpoints tests on mainnet environment..."
	TESTS_FULL=true ./tests.sh mainnet

query_endpoints_full_tests_all: query_endpoints_full_tests_staging query_endpoints_full_tests_testnet query_endpoints_full_tests_mainnet
