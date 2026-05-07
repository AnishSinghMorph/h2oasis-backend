# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies so we only copy production ones to the final image
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user first
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application with proper ownership
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy ecosystem config for PM2
COPY --from=builder --chown=nextjs:nodejs /app/ecosystem.config.js ./

# Install PM2 globally
RUN npm install -g pm2

# Create uploads and PM2 directories and set ownership
RUN mkdir -p /app/uploads /app/.pm2 && chown -R nextjs:nodejs /app/uploads /app/.pm2

# Set PM2 Home directory so it doesn't try to write to root
ENV PM2_HOME=/app/.pm2

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start BOTH the API and the Worker using PM2
CMD ["pm2-runtime", "ecosystem.config.js"]
