FROM oven/bun:1 AS base

WORKDIR /usr/src/app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

USER bun

ENTRYPOINT ["bun", "run", "index.ts"]
