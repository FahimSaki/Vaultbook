# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Assemble the runtime tree the same way scripts/package-portable.mjs does:
# the standalone trace can miss sharp's platform packages under pnpm, so copy them
# explicitly. cp -a keeps the symlinks pnpm relies on.
RUN mkdir -p /out \
    && cp -a .next/standalone/. /out/ \
    && mkdir -p /out/node_modules/.pnpm \
    && for d in node_modules/.pnpm/@img+sharp*; do rm -rf "/out/$d"; cp -a "$d" "/out/$d"; done \
    && cp -a .next/static /out/.next/static \
    && cp -a public /out/public \
    && cp -a src/server/db/migrations /out/migrations \
    && rm -f /out/.env* && rm -rf /out/.devdata /out/data

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /out ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]