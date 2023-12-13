.PHONY: build-docker-shell

# lldb -- bun tsc --build --verbose
# apk add lldb
# docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined -it bun-shell
build-docker-shell:
	docker build --progress=plain --target shell -t bun-shell .
	docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --privileged -it bun-shell
