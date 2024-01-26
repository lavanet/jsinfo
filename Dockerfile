FROM node:21.6 as base
WORKDIR /usr/src/app

# install dependencies
COPY package.json .
RUN npm install
RUN npm install tsx

# copy all (non-ignored) project files into the image
COPY . .

# Add scripts
RUN apt-get update && apt-get install -y curl jq
COPY scripts scripts