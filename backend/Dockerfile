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
CMD ["node", "dist/main.js"]
