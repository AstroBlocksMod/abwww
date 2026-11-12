# syntax=docker/dockerfile:1

# Builds the site. The editor is built separately (see docs/editor.md) and mounted or copied into
# /app/editor; pass --build-arg EDITOR_DIR=<path> to bake a local editor build into the image.

FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM oven/bun:1.4 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile
COPY --from=build /app/build ./build
COPY drizzle ./drizzle
ARG EDITOR_DIR=./editor-placeholder
COPY ${EDITOR_DIR} ./editor
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
ENV PORT=3000 HOST=0.0.0.0 DATA_DIR=/app/data EDITOR_DIR=/app/editor MIGRATIONS_DIR=/app/drizzle
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["bun", "./build"]
