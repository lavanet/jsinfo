.PHONY: build_bun_docker connect_to_bun_docker run_docker_compose indexer query

build_bun_docker:
	docker build --progress=plain -t bun-docker .

connect_to_bun_docker:
	docker run --privileged -it bun-docker /bin/sh

run_docker_compose:
	docker-compose -f docker-compose.yml up

run_indexer:
	bun run src/indexer.ts

run_query:
	bun run src/query.ts