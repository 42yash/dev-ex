# Dev-Ex Platform

> **Autonomous Development Platform & Modular Documentation Q&A System**

Dev-Ex is a dual-purpose system that combines an AI-driven autonomous development platform with a modular documentation Q&A application. It represents a new paradigm in software development where AI agents accelerate the development lifecycle while maintaining human control over critical decisions.

## 🎯 Project Overview

### The Platform Components

1. **The Autonomous Development Platform ("The Factory")**
   - AI-agent orchestration system powered by n8n
   - Automates the software development lifecycle from ideation to scaffolding
   - Self-improving capability through meta-agent architecture

2. **The Documentation Q&A Application ("The Product")**
   - Modular, conversational AI guide for technical documentation
   - Serves as both the first product and proof-of-concept
   - Extensible connector architecture for multiple documentation sources

## 🏗️ Architecture

The platform implements a microservices architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│          Frontend (Vue.js)               │
├─────────────────────────────────────────┤
│      API Gateway (Node.js/Fastify)       │
├─────────────────────────────────────────┤
│      AI Services (Python/gRPC)           │
├─────────────────────────────────────────┤
│   Data Layer (PostgreSQL/pgvector)       │
└─────────────────────────────────────────┘
```

## 📚 Documentation

The documentation is organized in Obsidian-optimized folders for easy navigation and linking.

### [📖 Documentation Hub](docs/README.md)
Your starting point for all documentation, optimized for Obsidian vault navigation.

### Core Sections
- [**🎮 CodeCraft Game System**](docs/00-codecraft/README.md) - Gamified development platform
- [**🏭 Dev-Ex Platform**](docs/01-platform/README.md) - Autonomous development factory
- [**⚙️ Implementation**](docs/02-implementation/README.md) - Technical implementation details
- [**🚀 Deployment**](docs/03-deployment/README.md) - Setup and operations guides
- [**📈 Development Progress**](docs/04-development/README.md) - Current status and roadmap

### Quick Links
- [Game Guide](docs/00-codecraft/game-guide.md) - Learn the CodeCraft system
- [Platform Overview](docs/01-platform/platform-overview.md) - Complete technical specification
- [Quick Start](docs/03-deployment/quickstart.md) - Get running in minutes
- [Development Progress](docs/04-development/progress.md) - See what's new

### Implementation Guides
- [Frontend Development](docs/02-implementation/frontend/overview.md) - Vue.js application
- Backend Services (Node.js)
- AI Services (Python)
- Connector Development

### Deployment & Operations
- Docker Compose Setup
- Kubernetes Deployment
- CI/CD Pipeline
- Monitoring & Observability

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- PostgreSQL with pgvector extension

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/dev-ex.git
   cd dev-ex
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - n8n Orchestration: http://localhost:5678
   - API Gateway: http://localhost:8080

## 🤖 Core Agents

### The Agent Pipeline

1. **Agent 0: The Architect Agent** 🏛️
   - Meta-agent that generates system prompts for other agents
   - Ensures consistency and security across the agent ecosystem

2. **Agent 1: Idea Generation Agent** 💡
   - Transforms vague concepts into structured project ideas
   - Provides multiple variations and refinement questions

3. **Agent 2: Technical Documentation Agent** ✍️
   - Converts ideas into comprehensive technical specifications
   - Interactive, multi-stage documentation process

4. **Agent 3: Code Scaffolding Agent** 🏗️
   - Generates complete project scaffolds
   - Manages sub-agents for different technical aspects

## 🔧 Technology Stack

### Frontend
- **Framework**: Vue.js 3 with Composition API
- **State Management**: Pinia
- **Communication**: gRPC-Web
- **Build Tool**: Vite

### Backend
- **API Gateway**: Node.js with Fastify
- **Orchestration**: n8n workflow automation
- **Communication**: gRPC with Protocol Buffers
- **Cache**: Redis

### AI Services
- **Language**: Python 3.11
- **AI Model**: Google Gemini Pro
- **Vector Database**: PostgreSQL with pgvector
- **Framework**: Custom agent architecture

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## 📖 Key Features

### Autonomous Development Platform
- Visual workflow orchestration with n8n
- Human-in-the-loop approval system
- Self-improving agent generation
- Modular agent architecture

### Documentation Q&A System
- Interactive pathway navigation
- Dynamic widget system
- Multiple documentation connectors
- Semantic search with vector embeddings

### Security & Reliability
- JWT-based authentication
- Rate limiting and quota management
- Comprehensive error handling
- Automated backup and recovery

## 🛠️ Development

### Project Structure
```
dev-ex/
├── frontend/           # Vue.js application
├── backend/
│   ├── gateway/       # Node.js API gateway
│   └── ai-services/   # Python AI services
├── docs/              # Documentation
├── prompts/           # AI agent prompts
└── deployment/        # Deployment configurations
```

### Running Tests
```bash
# Frontend tests
npm test --prefix frontend

# Backend tests
npm test --prefix backend/gateway

# AI service tests
pytest backend/ai-services/tests
```

### Building for Production
```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Deploy to Kubernetes
kubectl apply -f deployment/k8s/
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](docs/guides/contributing.md) for details on:
- Code style and standards
- Testing requirements
- Pull request process
- Development workflow

## 📊 Monitoring & Observability

The platform includes comprehensive monitoring:
- **Metrics**: Prometheus metrics for all services
- **Logging**: Structured logging with correlation IDs
- **Tracing**: OpenTelemetry distributed tracing
- **Dashboards**: Pre-configured Grafana dashboards

## 🔐 Security

Security is a core consideration:
- Input validation and sanitization
- Rate limiting and DDoS protection
- Secure communication with TLS/gRPC
- Regular security audits
- Automated vulnerability scanning

## 📝 License

This project is proprietary software. All rights reserved.

## 🙏 Acknowledgments

- Built with inspiration from modern cloud architectures
- Leverages best practices from the open-source community
- Designed for extensibility and maintainability

## 📞 Support

For support and questions:
- Documentation: [Full Technical Specification](docs/dev-ex.md)
- Issues: GitHub Issues
- Email: support@dev-ex.platform

---

**Version**: 2.0  
**Last Updated**: December 2024  
**Status**: Production Specification