# RefStats — tek konteyner (API + derlenmiş React arayüzü)
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run generate -w server && npm run build -w client

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
# Prisma CLI (migrate deploy) çalışma anında gerektiği için bağımlılıklar budanmaz.
COPY --from=build /app /app
EXPOSE 4000
# Açılışta bekleyen migration'lar uygulanır, sistem kategorileri yüklenir (idempotent), ardından sunucu başlar.
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && npx tsx prisma/seed.ts && node --import tsx src/index.ts"]
