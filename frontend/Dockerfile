# Build stage: produce static assets in /app/dist.
FROM hub.hamdocker.ir/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://repo.hmirror.ir/npm
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: serve dist only (no nginx; upstream proxy handles TLS/routing).
FROM hub.hamdocker.ir/node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
RUN npm config set registry https://repo.hmirror.ir/npmf
RUN npm install -g serve@14

COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3000"]
