FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run prisma:generate && npm run build

EXPOSE 4000
# Migrate on boot (safe, idempotent), then serve. Never use db push/sync here.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/src/main.js"]
