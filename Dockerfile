# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.0.7-alpine as base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json /temp/dev/
RUN cd /temp/dev && bun install

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM install AS prerelease_deps
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

FROM prerelease_deps AS prerelease
RUN bun run build --verbose

# start a shell in the prerelease image
FROM prerelease_deps AS shell
RUN apk add lldb
CMD ["/bin/sh"]

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install --chown=bun:bun /temp/dev/node_modules node_modules
COPY --from=prerelease --chown=bun:bun /usr/src/app/drizzle drizzle
COPY --from=prerelease --chown=bun:bun /usr/src/app/dist .

# switch to user
USER bun