---
title: CodeCraft Deployment Guide
tags: [deployment, setup, installation, operations]
created: 2025-01-09
updated: 2025-01-09
---

# 🚀 CodeCraft Deployment Guide

> **Launch Your Quest Into The Digital Realm**

## 📋 Prerequisites

### System Requirements
```yaml
Minimum:
  CPU: 2 cores
  RAM: 4GB
  Storage: 10GB
  OS: Linux/macOS/Windows with WSL2

Recommended:
  CPU: 4+ cores
  RAM: 8GB+
  Storage: 20GB SSD
  OS: Ubuntu 22.04 / macOS 13+
```

### Software Requirements
```bash
# Required
node >= 18.0.0
npm >= 9.0.0
python >= 3.11
docker >= 24.0.0
docker-compose >= 2.20.0

# Optional (for development)
git >= 2.40.0
make >= 4.0
postgresql-client >= 15
redis-tools >= 7.0
```

## 🐳 Docker Deployment (Recommended)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/codecraft/codecraft.git
cd codecraft

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Access the application
open http://localhost:5173
```

### Docker Compose Configuration
```yaml
version: '3.8'

services:
  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://gateway:3000
    depends_on:
      - gateway
    networks:
      - codecraft-network

  gateway:
    build: 
      context: ./backend/gateway
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - GRPC_URL=ai-service:50051
    depends_on:
      - redis
      - ai-service
    networks:
      - codecraft-network

  ai-service:
    build: 
      context: ./backend/ai-services
      dockerfile: Dockerfile
    ports:
      - "50051:50051"
    environment:
      - PYTHON_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
    networks:
      - codecraft-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=codecraft
      - POSTGRES_USER=codecraft
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - codecraft-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    networks:
      - codecraft-network

volumes:
  postgres-data:
  redis-data:

networks:
  codecraft-network:
    driver: bridge
```

## 💻 Manual Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/codecraft/codecraft.git
cd codecraft
```

### Step 2: Install Frontend
```bash
cd frontend
npm install

# Development
npm run dev

# Production build
npm run build
npm run preview
```

### Step 3: Install Gateway
```bash
cd backend/gateway
npm install

# Development
npm run dev

# Production
npm run build
npm run start
```

### Step 4: Install AI Service
```bash
cd backend/ai-services
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run service
python server.py
```

### Step 5: Setup Database
```bash
# PostgreSQL
createdb codecraft
psql codecraft < schema.sql

# Redis (if not using Docker)
redis-server
```

## 🔧 Configuration

### Environment Variables
```bash
# .env file

# AI Configuration
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/codecraft
REDIS_URL=redis://localhost:6379

# Gateway
GATEWAY_PORT=3000
JWT_SECRET=your-secret-key-here
SESSION_TIMEOUT=86400

# Frontend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Features
ENABLE_GAMIFICATION=true
ENABLE_MULTI_AGENT=false
ENABLE_ACHIEVEMENTS=true
```

### Configuration Files

#### Frontend Config
```javascript
// frontend/src/config.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  features: {
    gamification: true,
    multiAgent: false,
    achievements: true
  }
}
```

#### Gateway Config
```javascript
// backend/gateway/config.js
module.exports = {
  port: process.env.GATEWAY_PORT || 3000,
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  grpc: {
    url: process.env.GRPC_URL || 'localhost:50051'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h'
  }
}
```

## 🌐 Production Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start ecosystem.config.js

# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'codecraft-gateway',
      script: './backend/gateway/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'codecraft-ai',
      script: './backend/ai-services/server.py',
      interpreter: 'python3',
      env: {
        PYTHON_ENV: 'production'
      }
    }
  ]
}
```

### Using Kubernetes
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: codecraft-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: codecraft-frontend
  template:
    metadata:
      labels:
        app: codecraft-frontend
    spec:
      containers:
      - name: frontend
        image: codecraft/frontend:latest
        ports:
        - containerPort: 5173
        env:
        - name: VITE_API_URL
          value: "http://gateway-service:3000"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  selector:
    app: codecraft-frontend
  ports:
  - port: 80
    targetPort: 5173
  type: LoadBalancer
```

### Using AWS
```bash
# Deploy with AWS CDK
npm install -g aws-cdk
cd infrastructure
cdk deploy CodeCraftStack

# Or use Terraform
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## 🔒 Security Hardening

### SSL/TLS Setup
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name codecraft.dev;
    
    ssl_certificate /etc/ssl/certs/codecraft.crt;
    ssl_certificate_key /etc/ssl/private/codecraft.key;
    
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
    
    location /api {
        proxy_pass http://localhost:3000;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### Firewall Rules
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5173/tcp  # Frontend (dev only)
sudo ufw allow 3000/tcp  # API (dev only)
sudo ufw enable
```

## 📊 Monitoring

### Health Checks
```bash
# Check all services
curl http://localhost:3000/health
curl http://localhost:50051/health

# Docker health
docker-compose ps
docker stats
```

### Logging
```bash
# View logs
docker-compose logs -f gateway
docker-compose logs -f ai-service

# Log aggregation with ELK
docker-compose -f docker-compose.elk.yml up -d
```

### Metrics with Prometheus
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'codecraft'
    static_configs:
      - targets: ['gateway:3000', 'ai-service:50051']
```

## 🔄 Backup & Recovery

### Database Backup
```bash
# Backup
pg_dump codecraft > backup_$(date +%Y%m%d).sql

# Restore
psql codecraft < backup_20250109.sql

# Automated backups
0 2 * * * pg_dump codecraft | gzip > /backups/codecraft_$(date +\%Y\%m\%d).sql.gz
```

### Docker Volume Backup
```bash
# Backup volumes
docker run --rm -v codecraft_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volumes
docker run --rm -v codecraft_postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 <PID>
```

#### Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
# Restart if needed
sudo systemctl restart postgresql
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli ping
# Should return PONG
```

#### AI Service Not Responding
```bash
# Check Python logs
docker-compose logs ai-service
# Verify API key
echo $OPENAI_API_KEY
```

## 📈 Performance Tuning

### Frontend Optimization
```bash
# Build with optimization
npm run build -- --mode production

# Enable gzip compression
npm install compression
```

### Gateway Optimization
```javascript
// Clustering for multi-core
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  startServer();
}
```

### Database Optimization
```sql
-- Add indexes
CREATE INDEX idx_player_level ON players(level);
CREATE INDEX idx_quests_status ON player_quests(status);

-- Vacuum and analyze
VACUUM ANALYZE;
```

## 🔗 Related Documentation

- [Platform Architecture](../01-platform/README.md)
- [Development Roadmap](../07-roadmap/README.md)
- [API Reference](../05-api/README.md)

---

*"Deploy your realm, let the adventure begin!"*