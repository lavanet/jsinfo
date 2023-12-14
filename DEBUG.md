### Debugging the bun docker
Add this to the docker file
```
FROM prerelease_deps AS shell
CMD ["/bin/sh"]
```

Docker commands
```
docker build --progress=plain --target shell -t bun-shell .
docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --privileged -it bun-shell
docker build --progress=plain -t bun-docker . && docker run --privileged -it bun-docker /bin/sh
```

### Checking that the rpc service is online
Browse to this rest api and see a json output:
```
https://public-rpc.lavanet.xyz/rest/lavanet/lava/spec/show_all_chains
```