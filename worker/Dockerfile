# The Hewn worker: one image for a developer machine (Docker) and the cloud (L2-027 AC1). Only configuration differs:
#   HEWN_API_URL, HEWN_WORKER_TOKEN, HEWN_LOCATION (Local or Cloud), HEWN_WORKER_NAME, and the Magic Patterns settings.
# It opens no port: every connection is outbound to the Hewn API (L2-027 AC3).

FROM node:24-bookworm-slim AS build
WORKDIR /worker
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
# git for workspaces; ffmpeg for increment videos.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY --from=build /worker/package.json ./
COPY --from=build /worker/node_modules ./node_modules
COPY --from=build /worker/dist ./dist
ENV NODE_ENV=production \
    HEWN_LOCATION=Local
USER node
ENTRYPOINT ["node", "dist/main.js"]
