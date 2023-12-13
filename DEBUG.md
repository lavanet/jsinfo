### Debugging the bun docker
Add this to docker file
```
FROM prerelease_deps AS shell
CMD ["/bin/sh"]
```

Bash commands
```
docker build --progress=plain --target shell -t bun-shell .
docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --privileged -it bun-shell
```

### Checking that the rpc service is online
Browse to this rest api and see a json output:
```
https://public-rpc.lavanet.xyz/rest/lavanet/lava/spec/show_all_chains
```