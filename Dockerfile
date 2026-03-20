# Build stage: produce static assets in /app/dist (same-origin /api/; nginx proxies in runtime).
FROM hub.hamdocker.ir/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://repo.hmirror.ir/npm
RUN npm ci

COPY . .
RUN npm run build

# Runtime: nginx proxies /api/ to the Django Service inside the cluster.
FROM hub.hamdocker.ir/library/nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
