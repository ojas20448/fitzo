FROM node:24-bookworm-slim

ARG APP_GIT_COMMIT
LABEL org.opencontainers.image.source="https://github.com/ojas20448/fitzo" \
      org.opencontainers.image.revision="${APP_GIT_COMMIT}"

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

COPY backend/src ./src
COPY backend/certs ./certs
COPY backend/scripts/check_deployment.js ./scripts/check_deployment.js
# aiJobs imports this shared contract from outside the backend directory.
COPY ai-worker/contracts.js /app/ai-worker/contracts.js

ENV PORT=3001
USER node
EXPOSE 3001
CMD ["node", "--max-old-space-size=384", "src/index.js"]
