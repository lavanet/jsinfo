# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.0.25-alpine as base
RUN mkdir /lava
WORKDIR /lava

# needed for process_monitor.py
RUN apk add --update python3 py3-pip git bash jq curl make gcc go linux-headers

# support for the lavapProviderHealth script
RUN pip3 install requests python-dateutil psycopg2-binary redis

# health probe branch - 20/06/2024 commit
RUN git clone https://github.com/lavanet/lava.git . && git checkout 688e89ee59b48161688939f7e52641de5b0c0b88
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
