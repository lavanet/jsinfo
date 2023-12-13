# use the official Node.js image
FROM node:14 as base
WORKDIR /usr/src/app

# install dependencies into temp directory
FROM base AS install
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM install AS prerelease
COPY --from=install /usr/src/app/node_modules node_modules
COPY . .
RUN npm run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /usr/src/app/node_modules node_modules
COPY --from=prerelease /usr/src/app/dist .