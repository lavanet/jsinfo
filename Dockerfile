FROM oven/bun:1.1.34-alpine as base

# needed for process_monitor.py
RUN apk add --update python3 py3-pip git bash jq curl
RUN pip3 install requests python-dateutil

WORKDIR /app

COPY . .

RUN bun install
RUN bun run build --verbose
