
FROM node:20-alpine AS builder


WORKDIR /app


COPY package*.json ./


RUN npm ci --quiet


COPY . .


RUN npm run build

RUN npm prune --production


FROM node:20-alpine AS production


ENV NODE_ENV=production

WORKDIR /app


RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs


COPY --from=builder --chown=nodejs:nodejs /app/lib ./lib


COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules


COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./


RUN mkdir -p /app/uploads/audio && \
    chown -R nodejs:nodejs /app/uploads


USER nodejs


EXPOSE 3000


HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); })"


CMD ["node", "lib/server.js"]


