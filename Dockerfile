# syntax=docker/dockerfile:1
# Multi-stage build: compile the React client, then ship one small Node image that serves API + client.
FROM node:25-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:25-alpine
ENV NODE_ENV=production SERVE_CLIENT=true API_PORT=5050
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY server/ server/
COPY --from=client /app/client/dist client/dist
USER node
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD wget -qO- "http://127.0.0.1:${PORT:-5050}/api/health/ready" || exit 1
CMD ["node", "server/server.js"]
