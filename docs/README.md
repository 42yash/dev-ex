# 🎮 CodeCraft

> **Transform Software Development Into An Epic Quest**

[![Version](https://img.shields.io/badge/version-0.5.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Status](https://img.shields.io/badge/status-foundation_phase-yellow)]()
[![XP](https://img.shields.io/badge/XP-1250/10000-gold)]()

CodeCraft is a revolutionary development platform that gamifies the entire software development lifecycle. Write code through strategic decisions, collaborate with AI companions, and watch your projects come to life through an epic adventure.

## ✨ Features

### 🎯 Currently Implemented
- **14 Interactive Widgets** - From code editors to decision forms
- **AI Chat Integration** - Intelligent conversation and assistance
- **Real-time Updates** - WebSocket-powered live interactions
- **Session Management** - Persistent development sessions
- **Code Execution** - Run Python code directly (more languages coming)
- **Docker Deployment** - Easy setup and scaling

### 🚧 In Development
- **Full Gamification Layer** - XP, levels, achievements
- **Multi-Agent System** - Specialized AI companions
- **Quest Framework** - Turn tasks into adventures
- **Visual Game UI** - Animations, particles, sound effects
- **Community Features** - Guilds, leaderboards, collaboration

## 🚀 Quick Start

### Using Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/yourusername/codecraft
cd codecraft

# Start all services
docker-compose up -d

# Access the platform
open http://localhost:5173
```

### Manual Setup
```bash
# Prerequisites
# - Node.js 18+
# - Python 3.11+
# - PostgreSQL 15+
# - Redis 7+

# Install dependencies
npm install
cd backend/gateway && npm install
cd ../ai-services && pip install -r requirements.txt

# Start services
npm run dev          # Frontend (port 5173)
npm run gateway      # Gateway (port 3000)
python server.py     # AI Service (port 50051)
```

## 🎮 How to Play

1. **Start Your Quest**
   - Open CodeCraft in your browser
   - Create a new session or continue existing
   - Choose your first quest

2. **Make Strategic Decisions**
   - Use interactive widgets to make choices
   - Each decision impacts your code
   - Watch your XP grow

3. **Collaborate with AI Companions**
   - Chat with the AI assistant
   - Request help on specific tasks
   - Learn from expert guidance

4. **Build Real Applications**
   - Generate production-ready code
   - Test and deploy your creations
   - Share with the community

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

- [📖 Documentation Hub](docs/README.md) - Start here
- [🎮 Vision & Concepts](docs/00-vision/README.md) - The CodeCraft philosophy
- [🏰 Platform Architecture](docs/01-platform/README.md) - Technical details
- [🎯 Widget System](docs/02-widgets/README.md) - Interactive components
- [🤖 AI Agents](docs/03-agents/README.md) - Your companions
- [🛠️ Implementation Guide](docs/04-implementation/current-state.md) - Current state
- [🚀 Roadmap](docs/07-roadmap/README.md) - What's coming

## 🏗️ Architecture

```
codecraft/
├── frontend/              # Vue.js game interface
│   └── src/
│       ├── components/    # UI components
│       ├── widgets/       # Interactive widgets (14 types)
│       ├── stores/        # State management
│       └── views/         # Main views
├── backend/
│   ├── gateway/          # Node.js API gateway
│   └── ai-services/      # Python AI service
├── proto/                # Protocol definitions
├── docs/                 # Documentation
└── docker-compose.yml    # Container orchestration
```

## 🎯 Current Implementation Status

### Phase 0: Foundation ✅ COMPLETE
- Basic chat interface
- 14 functional widgets
- Single AI assistant
- Session management
- Docker deployment

### Phase 1: Game Layer 🚧 IN PROGRESS (35%)
- XP and leveling system
- Quest framework
- Achievement system
- Game UI overlay

### Phase 2: Multi-Agent System ⏳ PLANNED
- Specialized AI personalities
- Agent collaboration
- Expertise routing

## 🤝 Contributing

We welcome contributions! Here's how to get involved:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Run tests** (`npm test`)
5. **Commit** (`git commit -m 'Add amazing feature'`)
6. **Push** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

See [Contributing Guide](docs/04-implementation/contributing.md) for detailed guidelines.

## 🛠️ Development

### Available Scripts

```bash
# Frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code

# Gateway
npm run gateway      # Start gateway server
npm run gateway:dev  # Start with hot reload

# AI Service
python server.py     # Start AI service
python test.py       # Run tests

# Full Stack
make dev            # Start everything
make test           # Run all tests
make build          # Build all services
```

### Environment Variables

Create a `.env` file:

```env
# AI Service
OPENAI_API_KEY=your_key_here
AI_MODEL=gpt-4

# Database
DATABASE_URL=postgresql://user:pass@localhost/codecraft
REDIS_URL=redis://localhost:6379

# Gateway
PORT=3000
JWT_SECRET=your_secret
```

## 📊 Metrics

### Code Statistics
- **Lines of Code**: ~15,000
- **Test Coverage**: 78%
- **Widget Types**: 14
- **API Endpoints**: 12
- **WebSocket Events**: 8

### Performance
- **Widget Render**: <50ms
- **API Response**: <200ms
- **Session Switch**: <100ms
- **Code Execution**: <2s

## 🐛 Known Issues

- WebSocket reconnection needs improvement
- Code execution limited to Python
- Memory leak in widget manager (being fixed)
- Some visual glitches in dark mode

## 📈 Roadmap

### Q1 2025
- ✅ Foundation (Phase 0)
- 🚧 Gamification Layer (Phase 1)
- ⏳ Multi-Agent System (Phase 2)

### Q2 2025
- Advanced Widgets
- Visual Enhancement
- Community Features

### Q3 2025
- Mobile Support
- Plugin System
- Enterprise Features

See [Full Roadmap](docs/07-roadmap/README.md) for details.

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Vue.js team for the amazing framework
- OpenAI/Anthropic for AI capabilities
- Our growing community of developer-adventurers

## 📞 Support

- **Discord**: [Join our server](#)
- **Issues**: [GitHub Issues](https://github.com/yourusername/codecraft/issues)
- **Email**: support@codecraft.dev
- **Docs**: [Documentation](docs/README.md)

## 🏆 Stats

```
Current Quest: Transform Documentation
XP Earned: 1,250 / 10,000
Level: 5
Achievements Unlocked: 7
Widgets Mastered: 14 / 50
```

---

<div align="center">

**🎮 Start Your Quest Today! 🎮**

*In CodeCraft, every bug is a puzzle, every feature is a quest reward,*
*and every developer is a hero on an epic journey.*

[**Play Now**](http://localhost:5173) | [**Read Docs**](docs/README.md) | [**Join Community**](#)

</div>