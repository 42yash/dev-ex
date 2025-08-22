# Quick Start Guide

Welcome to Dev-Ex! This guide will help you get the platform up and running in under 15 minutes.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Node.js** 18+ (for local development)
- **Python** 3.11+ (for AI services development)
- **Git** for version control
- At least **8GB RAM** (16GB recommended)
- **20GB free disk space**

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/42yash/dev-ex.git
cd dev-ex
```

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

**Required environment variables:**

```bash
# AI Configuration (REQUIRED)
GEMINI_API_KEY=your-gemini-api-key-here

# Authentication (generate secure values)
JWT_SECRET=your-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=another-secure-secret-min-32-chars

# Database (use defaults for development)
DB_NAME=devex
DB_USER=devex
DB_PASSWORD=devex

# Redis (use defaults for development)
REDIS_PASSWORD=redis-password

# n8n (workflow orchestration)
N8N_USER=admin
N8N_PASSWORD=admin
```

### 3. Start the Platform

```bash
# Start all services with Docker Compose
docker-compose up -d

# Wait for services to initialize (about 30 seconds)
sleep 30

# Check that all services are running
docker-compose ps
```

### 4. Access the Applications

Once all services are running, you can access:

- **Frontend Application**: <http://localhost:3000>
- **API Gateway**: <http://localhost:8080>
- **n8n Workflow Editor**: <http://localhost:5678> (admin/admin)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## First Steps

### 1. Create Your First Chat Session

Navigate to <http://localhost:3000> and you'll see the main chat interface.

Try these example queries:

- "How do I deploy a static website to AWS?"
- "What's the best way to implement user authentication?"
- "Help me design a scalable microservices architecture"

### 2. Explore Interactive Pathways

The system will present you with interactive choices:

```
┌─────────────────────────────────────┐
│  How would you like to proceed?     │
├─────────────────────────────────────┤
│ 🌐 S3 Static Hosting                │
│    Simple, cost-effective           │
│    ✓ CDN ready ✗ No server-side    │
├─────────────────────────────────────┤
│ 🖥️ EC2 with Nginx                   │
│    Full control, flexible           │
│    ✓ Server-side ✗ More complex    │
├─────────────────────────────────────┤
│ 📦 Containerized with ECS           │
│    Scalable, modern                 │
│    ✓ Auto-scaling ✗ Higher cost    │
└─────────────────────────────────────┘
```

### 3. Use the Command Center

Press `Ctrl+K` (or `Cmd+K` on Mac) to open the command center:

- `search <query>` - Search documentation
- `theme dark|light` - Switch theme
- `switch to <connector>` - Change documentation source

## Development Setup

### Frontend Development

```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:3000
```

### Backend Development

```bash
cd backend/gateway
npm install
npm run dev
# API Gateway available at http://localhost:8080
```

### AI Services Development

```bash
cd backend/ai-services
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
# AI Services available at http://localhost:50051
```

## Testing the Installation

### 1. Health Check

```bash
# Check all services are healthy
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","services":{"api":"up","ai":"up","db":"up","redis":"up"}}
```

### 2. Test Chat Functionality

```bash
# Create a session
SESSION_ID=$(curl -X POST http://localhost:8080/api/v1/session | jq -r '.session_id')

# Send a message
curl -X POST http://localhost:8080/api/v1/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"message\": \"Hello, Dev-Ex!\"
  }"
```

### 3. Test Documentation Search

```bash
# Search documentation
curl -X POST http://localhost:8080/api/v1/search \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"deploy static website\",
    \"limit\": 5
  }"
```

## Common Setup Issues

### Issue: Docker Compose fails to start

**Solution:**

```bash
# Check Docker is running
docker info

# Check port availability
lsof -i :3000 -i :8080 -i :5432 -i :6379

# Reset and restart
docker-compose down -v
docker-compose up -d
```

### Issue: Database connection errors

**Solution:**

```bash
# Check database is running
docker-compose exec postgres psql -U devex -d devex -c "SELECT 1"

# Reset database
docker-compose exec postgres psql -U devex -d devex -f /docker-entrypoint-initdb.d/init.sql
```

### Issue: AI service not responding

**Solution:**

```bash
# Check Gemini API key is set
echo $GEMINI_API_KEY

# Check AI service logs
docker-compose logs ai-services

# Restart AI service
docker-compose restart ai-services
```

### Issue: Frontend not loading

**Solution:**

```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

## Project Structure Overview

```
dev-ex/
├── frontend/              # Vue.js frontend application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── views/        # Page views
│   │   ├── stores/       # Pinia state management
│   │   └── services/     # API services
│   └── package.json
│
├── backend/
│   ├── gateway/          # Node.js API gateway
│   │   ├── src/
│   │   └── package.json
│   └── ai-services/      # Python AI services
│       ├── agents/       # AI agents
│       ├── connectors/   # Documentation connectors
│       └── requirements.txt
│
├── docs/                 # Documentation
├── database/            # Database schemas and migrations
├── workflows/           # n8n workflow definitions
├── docker-compose.yml   # Docker composition
└── .env.example        # Environment template
```

## Next Steps

### 1. Explore the Platform

- **Chat Interface**: Try different types of queries
- **Interactive Widgets**: Explore the pathway system
- **Command Center**: Master keyboard shortcuts

### 2. Configure Connectors

Add documentation sources:

```bash
# Access n8n workflow editor
# http://localhost:5678 (admin/admin)

# Configure AWS documentation connector
# Configure custom documentation sources
```

### 3. Customize Agents

Modify agent behavior in `backend/ai-services/agents/`:

- `architect.py` - Meta-agent for creating other agents
- `idea_generator.py` - Idea generation agent
- `technical_writer.py` - Documentation agent
- `scaffolder.py` - Code generation agent

### 4. Extend the Platform

- Add new widget types in `frontend/src/widgets/`
- Create custom connectors in `backend/ai-services/connectors/`
- Define new workflows in n8n

## Getting Help

### Documentation

- [Complete Technical Specification](../dev-ex.md)
- [Architecture Overview](../architecture/overview.md)
- [API Reference](../api/grpc-reference.md)
- [Deployment Guide](../deployment/docker.md)

### Community

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
- Wiki: Community-contributed guides

### Troubleshooting

Enable debug logging:

```bash
# In .env file
LOG_LEVEL=debug
NODE_ENV=development
PYTHON_ENV=development
```

View logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f api-gateway
docker-compose logs -f ai-services
```

## Production Deployment

For production deployment, see:

- [Docker Production Guide](../deployment/docker.md)
- [Kubernetes Deployment](../deployment/kubernetes.md)
- [Security Best Practices](../guides/security.md)

## License

This project is proprietary software. See LICENSE file for details.

---

**Congratulations!** You now have Dev-Ex running locally. Start exploring the platform and building amazing applications with AI-powered development assistance.
