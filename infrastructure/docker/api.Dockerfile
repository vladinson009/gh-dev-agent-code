FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace @devscope/shared \
  && npm run build --workspace @devscope/api

EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate --workspace @devscope/api && npm run start --workspace @devscope/api"]
