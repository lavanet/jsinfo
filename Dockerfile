# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.0.25-alpine as base
RUN mkdir /lava
WORKDIR /lava
RUN apk add --update python3 py3-pip git bash jq curl make gcc go linux-headers

# version  1.2.1
RUN git clone https://github.com/lavanet/lava.git . && git checkout d984bf4bc5eb83fe530fb5c1a206ece9911b32a4
RUN chmod +x ./scripts/init_install.sh && bash ./scripts/init_install.sh
RUN LAVA_BINARY=all make build
ENV PATH="/lava/build:${PATH}"
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json /temp/dev/
RUN cd /temp/dev && bun install

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM install AS prerelease
# nodejs required to compile protobufjs
RUN apk add --update nodejs
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun run build --verbose

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=prerelease /usr/src/app/drizzle drizzle
COPY --from=prerelease /usr/src/app/dist .

# Add scripts
COPY scripts scripts
COPY lavapProviderHealth lavapProviderHealth
