# --- build stage -----------------------------------------------------------
# python3/make/g++ are required so the native `bcrypt` binding compiles.
# bcryptjs would avoid them but runs on the main thread and blocks the event
# loop for the whole hash (research.md R-001).
FROM node:22-bookworm-slim AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Fail HERE, not at container start.
#
# `nest build` infers the output layout from the TypeScript config, and the image copies a subset
# of the repo — so a tsconfig change can move dist/main.js to dist/src/main.js and the build still
# reports success. The first sign is then `Cannot find module '/app/dist/main.js'` in a crash loop
# on the deployment target. One assertion turns that into a failed build with an obvious cause.
RUN test -f dist/main.js || (echo "BUILD ERROR: dist/main.js missing. Actual dist layout:" && ls -R dist | head -40 && exit 1)

RUN npm prune --omit=dev

# --- runtime stage ---------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# bcrypt runs on the libuv thread pool, which defaults to 4 threads regardless of
# core count. Login throughput is bounded by this number (research.md R-002).
ENV UV_THREADPOOL_SIZE=8

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

USER node
EXPOSE 3000

# Migrations run here, inside the container, on the way up.
#
# The database is only reachable from the private network on the deployment target, so a migration
# step that runs from a laptop needs a public endpoint that may not exist. The container already
# has one: it holds prisma/migrations, a working Prisma CLI, and the same DATABASE_URL the app
# uses. Nothing else is as well placed to do this.
#
# Details that matter:
#   - `node_modules/.bin/prisma`, not `npx prisma` — the local binary is used for certain, with no
#     chance of a registry fetch at boot.
#   - `&&`, so a failed migration stops the container instead of starting the API against a schema
#     it does not match. A crash loop naming the migration beats silent 500s on every route.
#   - `exec`, so node replaces the shell and becomes PID 1. Without it the shell holds PID 1 and
#     swallows SIGTERM, turning every redeploy into a kill after the grace period.
#   - `migrate deploy` applies only committed migrations and never generates or resets one. It is
#     a no-op when there is nothing pending, so it is safe on every boot. Concurrent replicas are
#     safe too: it takes an advisory lock, so one applies while the others wait.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
