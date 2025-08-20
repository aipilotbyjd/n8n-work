# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod ./
COPY go.sum* ./

# Download dependencies
RUN go mod download && go mod tidy

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/engine ./cmd/engine

# Development stage
FROM golang:1.21-alpine AS development

# Install development dependencies
RUN apk add --no-cache git ca-certificates tzdata curl wget

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod ./
COPY go.sum* ./

# Download dependencies
RUN go mod download && go mod tidy

# Expose ports
EXPOSE 50052 8080 9091

# Start with go run for development
CMD ["go", "run", "./cmd/engine"]

# Production stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1001 -S golang && adduser -S engine -u 1001

# Set working directory
WORKDIR /app

# Copy built binary
COPY --from=builder --chown=engine:golang /app/bin/engine ./engine

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ./engine health || exit 1

# Switch to non-root user
USER engine

# Expose ports
EXPOSE 50051 8080

# Run the application
ENTRYPOINT ["./engine"]
