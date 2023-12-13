.PHONY: build-docker-shell build-docker

build-docker-shell:
	docker build --progress=plain --target shell -t bun-shell .
	docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --privileged -it bun-shell

build-docker:
	docker build --progress=plain -t bun-shell .
