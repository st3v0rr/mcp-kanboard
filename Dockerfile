FROM node:22-alpine

WORKDIR /app

# Install only production dependencies (prefer lockfile when available)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source
COPY src ./src

# Optional: own the app directory for non-root runtime
RUN chown -R node:node /app

# Runtime defaults (override with -e at run time)
ENV NODE_ENV=production \
    PORT=8008 \
    KANBOARD_URL=http://kanboard:3000

EXPOSE 8008

# Lightweight healthcheck using busybox wget (present in Alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -T 3 -O - http://localhost:${PORT}/health > /dev/null || exit 1

# Drop privileges
USER node

CMD ["node", "src/kanboard-mcp-server.js"]
