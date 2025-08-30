# Dev-Ex Platform

> **Autonomous Development Platform & Modular Documentation Q&A System**

Dev-Ex is a dual-purpose system that combines an AI-driven autonomous development platform with a modular documentation Q&A application. It represents a new paradigm in software development where AI agents accelerate the development lifecycle while maintaining human control over critical decisions.

## 🎯 Project Overview

### The Platform Components

1. **The Autonomous Development Platform ("The Factory")**
   - AI-agent orchestration system with workflow management
   - Automates the software development lifecycle from ideation to deployment
   - Self-improving capability through Agent Darwin's evolutionary system
   - Dynamic agent creation with Agent Pool Maker

2. **The Documentation Q&A Application ("The Product")**
   - Modular, conversational AI guide for technical documentation
   - Interactive widget system for dynamic user interfaces
   - Extensible connector architecture for multiple documentation sources
   - Real-time workflow visualization and management

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

### Core Documentation
- [**Complete Technical Specification**](docs/dev-ex.md) - Comprehensive system documentation
- [**AWS Conversational Guide**](docs/AWS_TD.md) - AWS-specific implementation details

### Architecture & Design
- System Architecture Overview
- Component Specifications
- API Design & Protocol Buffers
- Database Schema

### Implementation Guides
- Frontend Development (Vue.js)
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

### Management Agents

1. **Agent Pool Maker (Agent 0)** 🏛️
   - Master orchestrator that creates and manages specialized agents
   - Analyzes project requirements to determine needed agents
   - Dynamically configures agent tools and permissions
   - Manages agent lifecycle and task distribution

2. **Agent Darwin** 🧬
   - Evolution and optimization system for agent performance
   - Monitors agent metrics and success rates
   - Updates agent prompts based on performance data
   - Implements continuous improvement through evolutionary strategies

### Workflow Agents

3. **Idea Generator Agent** 💡
   - Transforms vague concepts into structured project ideas
   - Provides multiple variations and refinement questions
   - Asks clarifying questions to refine concepts

4. **Technical Writer Agent** ✍️
   - Creates comprehensive technical specifications
   - Generates API documentation and user guides
   - Produces SRE documents and architecture diagrams

5. **Architect Agent** 🏗️
   - Designs system architecture and selects design patterns
   - Creates infrastructure diagrams and data models
   - Defines service boundaries and technology stack

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
- **AI Models**: Google Gemini Pro, Gemini 2.5 Flash
- **Vector Database**: PostgreSQL with pgvector
- **Framework**: Custom agent architecture with gRPC
- **Workflow Engine**: Custom workflow orchestrator

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