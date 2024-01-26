.PHONY: build_jsinfo_docker connect_to_jsinfo_docker run_docker_compose indexer query

build_docker:
	docker build --progress=plain -t jsinfo-docker .

connect_to_docker:
	docker run --privileged -it jsinfo-docker /bin/sh

run_docker_compose:
	docker-compose -f docker-compose.yml up

run_indexer:
	NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx src/indexer.ts

run_query:
	npx tsx src/query.ts