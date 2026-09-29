FROM node:22-bookworm-slim

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
