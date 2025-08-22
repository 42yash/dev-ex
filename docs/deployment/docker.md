# Docker Deployment Guide

## Overview

This guide covers deploying the Dev-Ex platform using Docker and Docker Compose for both development and production environments.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 8GB RAM minimum (16GB recommended)
- 20GB available disk space

## Development Environment

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8080
      - NODE_ENV=development
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  # API Gateway
  api-gateway:
    build:
      context: ./backend/gateway
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - JWT_SECRET=dev-secret
      - REDIS_URL=redis://redis:6379
      - AI_SERVICE_URL=ai-services:50051
    depends_on:
      - redis
      - ai-services
    volumes:
      - ./backend/gateway:/app
      - /app/node_modules

  # AI Services
  ai-services:
    build:
      context: ./backend/ai-services
      dockerfile: Dockerfile
    ports:
      - "50051:50051"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DATABASE_URL=postgresql://devex:devex@postgres:5432/devex
      - REDIS_URL=redis://redis:6379
      - PYTHON_ENV=development
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/ai-services:/app

  # n8n Orchestration
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=admin
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=development
    volumes:
      - n8n_data:/home/node/.n8n
      - ./workflows:/home/node/workflows

  # PostgreSQL with pgvector
  postgres:
    image: ankane/pgvector
    environment:
      - POSTGRES_DB=devex
      - POSTGRES_USER=devex
      - POSTGRES_PASSWORD=devex
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devex"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  n8n_data:
```

### Starting Development Environment

```bash
# Clone the repository
git clone https://github.com/your-org/dev-ex.git
cd dev-ex

# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
# Required: GEMINI_API_KEY
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Production Dockerfiles

### Frontend Dockerfile

```dockerfile
# Frontend Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### API Gateway Dockerfile

```dockerfile
# API Gateway Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### AI Services Dockerfile

```dockerfile
# AI Services Production Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1001 python && \
    chown -R python:python /app

# Copy installed packages and application
COPY --from=builder --chown=python:python /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder --chown=python:python /app .

# Switch to non-root user
USER python

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python healthcheck.py || exit 1

EXPOSE 50051

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "50051"]
```

## Production Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    image: devex/frontend:latest
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - api-gateway
    networks:
      - devex-network

  api-gateway:
    image: devex/api-gateway:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
      - AI_SERVICE_URL=ai-services:50051
    depends_on:
      - redis
      - ai-services
    networks:
      - devex-network

  ai-services:
    image: devex/ai-services:latest
    restart: unless-stopped
    deploy:
      replicas: 2
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - PYTHON_ENV=production
    depends_on:
      - postgres
      - redis
    networks:
      - devex-network

  n8n:
    image: n8nio/n8n
    restart: unless-stopped
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=${N8N_DB_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - devex-network

  postgres:
    image: ankane/pgvector
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - devex-network

  redis:
    image: redis:alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - devex-network

networks:
  devex-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  n8n_data:
```

## Building Images

### Build Script

```bash
#!/bin/bash
# build.sh - Build all Docker images

set -e

VERSION=${1:-latest}

echo "Building Dev-Ex Platform v${VERSION}"

# Build frontend
echo "Building frontend..."
docker build -t devex/frontend:${VERSION} -f frontend/Dockerfile ./frontend

# Build API Gateway
echo "Building API Gateway..."
docker build -t devex/api-gateway:${VERSION} -f backend/gateway/Dockerfile ./backend/gateway

# Build AI Services
echo "Building AI Services..."
docker build -t devex/ai-services:${VERSION} -f backend/ai-services/Dockerfile ./backend/ai-services

echo "All images built successfully!"

# Tag as latest
docker tag devex/frontend:${VERSION} devex/frontend:latest
docker tag devex/api-gateway:${VERSION} devex/api-gateway:latest
docker tag devex/ai-services:${VERSION} devex/ai-services:latest

echo "Images tagged as latest"
```

### Push to Registry

```bash
#!/bin/bash
# push.sh - Push images to registry

REGISTRY=${REGISTRY:-docker.io}
VERSION=${1:-latest}

# Login to registry
docker login ${REGISTRY}

# Tag for registry
docker tag devex/frontend:${VERSION} ${REGISTRY}/devex/frontend:${VERSION}
docker tag devex/api-gateway:${VERSION} ${REGISTRY}/devex/api-gateway:${VERSION}
docker tag devex/ai-services:${VERSION} ${REGISTRY}/devex/ai-services:${VERSION}

# Push images
docker push ${REGISTRY}/devex/frontend:${VERSION}
docker push ${REGISTRY}/devex/api-gateway:${VERSION}
docker push ${REGISTRY}/devex/ai-services:${VERSION}

echo "Images pushed to ${REGISTRY}"
```

## Environment Variables

### Required Variables

```bash
# .env.production
# Database
DB_NAME=devex
DB_USER=devex
DB_PASSWORD=<secure-password>
DATABASE_URL=postgresql://devex:<password>@postgres:5432/devex

# Redis
REDIS_PASSWORD=<secure-password>

# JWT
JWT_SECRET=<secure-jwt-secret>

# AI Service
GEMINI_API_KEY=<your-gemini-api-key>

# n8n
N8N_USER=admin
N8N_PASSWORD=<secure-password>
N8N_ENCRYPTION_KEY=<secure-encryption-key>
N8N_DB_PASSWORD=<secure-password>
```

## Docker Networking

### Network Configuration

```yaml
networks:
  devex-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Service Discovery

Services communicate using Docker's internal DNS:
- Frontend → api-gateway:8080
- API Gateway → ai-services:50051
- All services → postgres:5432, redis:6379

## Volume Management

### Backup Volumes

```bash
# Backup PostgreSQL data
docker run --rm \
  -v devex_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .

# Backup Redis data
docker run --rm \
  -v devex_redis_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/redis-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Volumes

```bash
# Restore PostgreSQL data
docker run --rm \
  -v devex_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres-20240101.tar.gz -C /data

# Restore Redis data
docker run --rm \
  -v devex_redis_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/redis-20240101.tar.gz -C /data
```

## Health Monitoring

### Docker Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' devex_api-gateway_1
```

### Monitoring Stack

```yaml
# monitoring.docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"

volumes:
  prometheus_data:
  grafana_data:
```

## Troubleshooting

### Common Issues

1. **Container fails to start**
   ```bash
   # Check logs
   docker-compose logs service-name
   
   # Inspect container
   docker inspect container-id
   ```

2. **Database connection issues**
   ```bash
   # Test database connection
   docker-compose exec postgres psql -U devex -d devex
   ```

3. **Network connectivity**
   ```bash
   # Test internal DNS
   docker-compose exec api-gateway ping postgres
   ```

4. **Resource constraints**
   ```bash
   # Check resource usage
   docker stats
   
   # Increase limits in docker-compose.yml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

## Security Best Practices

1. **Use non-root users** in containers
2. **Scan images** for vulnerabilities
3. **Use secrets management** for sensitive data
4. **Enable TLS** for external communication
5. **Implement network policies** to restrict communication
6. **Regular updates** of base images and dependencies

## Performance Optimization

1. **Multi-stage builds** to reduce image size
2. **Layer caching** for faster builds
3. **Health checks** for automatic recovery
4. **Resource limits** to prevent resource exhaustion
5. **Volume optimization** for database performance

## Related Documentation

- [Kubernetes Deployment](kubernetes.md)
- [CI/CD Pipeline](ci-cd.md)
- [Production Configuration](production.md)
- [Monitoring Guide](../guides/monitoring.md)