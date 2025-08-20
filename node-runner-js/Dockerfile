# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ src/

# Build the application
RUN npm run build

# Development stage
FROM node:18-alpine AS development

# Install system dependencies for development
RUN apk add --no-cache \
    dumb-init \
    curl \
    bash \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install && npm cache clean --force

# Create directories for sandbox operations
RUN mkdir -p /tmp/n8n-work-sandbox
RUN mkdir -p /app/logs

# Expose ports
EXPOSE 3002 50053

# Start in development mode with hot reload
CMD ["npm", "run", "start:dev"]

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for sandboxing and isolation
RUN apk add --no-cache \
    dumb-init \
    curl \
    bash \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S noderunner -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=noderunner:nodejs /app/dist ./dist
COPY --from=builder --chown=noderunner:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=noderunner:nodejs /app/package*.json ./

# Create directories for sandbox operations
RUN mkdir -p /tmp/n8n-work-sandbox && chown noderunner:nodejs /tmp/n8n-work-sandbox
RUN mkdir -p /app/logs && chown noderunner:nodejs /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER noderunner

# Expose port
EXPOSE 3000

# Start the application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
