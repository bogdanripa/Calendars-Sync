# Built for linux/arm64 in CI (pironman is a Raspberry Pi).
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
# curl: the platform's container healthcheck needs curl or wget.
RUN apk add --no-cache curl
WORKDIR /app
ARG GIT_SHA=unknown
ENV NODE_ENV=production PORT=80 GIT_SHA=$GIT_SHA
COPY --from=server /app/server/node_modules server/node_modules
COPY --from=server /app/server/package.json server/
COPY --from=server /app/server/dist server/dist
COPY --from=client /app/client/dist client/dist
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --start-interval=250ms \
  CMD curl -fsS http://localhost:80/api/health || exit 1
CMD ["node", "server/dist/index.js"]
