# Agent Specifications

## Core Management Agents

### Agent 0 (Agent Pool Maker)

**Role**: Master orchestrator responsible for creating and managing the agent ecosystem

**Capabilities**:
- Analyzes project requirements to determine needed agents
- Dynamically creates specialized agents based on technology stack
- Configures agent tools and permissions
- Manages agent lifecycle (creation, updates, termination)
- Distributes tasks among created agents

**Context Requirements**:
- Project requirements document
- Technology stack decisions
- Available MCP servers
- Resource constraints
- Timeline requirements

**Prompt Structure**:
```
You are Agent 0, the master orchestrator of the Dev-Ex platform.
Your role is to analyze project requirements and create the optimal
set of specialized agents to accomplish the development goals.

Core Responsibilities:
1. Requirement Analysis: Parse and understand project needs
2. Agent Determination: Identify required agent types
3. Agent Creation: Instantiate agents with appropriate configurations
4. Tool Assignment: Equip agents with necessary tools and MCP servers
5. Task Distribution: Assign work to agents based on capabilities

Decision Framework:
- Minimize agent count while ensuring coverage
- Match agent expertise to project technologies
- Consider dependencies between agents
- Optimize for parallel execution where possible
```

**Output Format**:
```json
{
  "requiredAgents": [
    {
      "type": "technology",
      "name": "Python FastAPI Agent",
      "tools": ["python_mcp", "fastapi_docs"],
      "responsibilities": ["API development", "endpoint creation"],
      "dependencies": ["Database Agent"]
    }
  ],
  "executionPlan": {
    "phases": [...],
    "parallelTasks": [...],
    "sequentialDependencies": [...]
  }
}
```

### Agent Darwin

**Role**: Evolutionary optimizer that improves agent performance over time

**Capabilities**:
- Monitors agent performance metrics
- Analyzes successful and failed interactions
- Updates agent prompts based on learnings
- Optimizes inter-agent communication
- Implements feedback loops

**Evolution Strategies**:
1. **Performance Monitoring**:
   - Task completion rates
   - Error frequencies
   - Code quality metrics
   - Time to completion

2. **Prompt Optimization**:
   - A/B testing different prompt variations
   - Incorporating successful patterns
   - Removing ineffective instructions
   - Adding context from failures

3. **Collaboration Enhancement**:
   - Improving handoff protocols
   - Optimizing data formats
   - Reducing communication overhead

**Prompt Evolution Example**:
```
Generation 1: "Create a REST API endpoint"
Generation 2: "Create a REST API endpoint with error handling"
Generation 3: "Create a REST API endpoint with error handling, input validation, and OpenAPI documentation"
```

## Workflow Phase Agents

### Idea Generator Agent

**Phase**: Brainstorming

**Capabilities**:
- Transforms vague ideas into concrete concepts
- Asks clarifying questions
- Suggests similar existing solutions
- Identifies potential challenges
- Proposes innovative features

**Interaction Pattern**:
```typescript
interface IdeaGeneratorInput {
  userIdea: string;
  domain?: string;
  targetAudience?: string;
  constraints?: string[];
}

interface IdeaGeneratorOutput {
  refinedConcept: string;
  questions: DynamicQuestion[];
  similarProjects: Reference[];
  uniqueValueProps: string[];
  potentialChallenges: Challenge[];
}
```

### Technical Writer Agent

**Phase**: Requirements Engineering

**Capabilities**:
- Creates comprehensive requirement documents
- Writes user stories and acceptance criteria
- Generates technical specifications
- Produces API documentation
- Creates SRE documents

**Document Templates**:
- Software Requirements Specification (SRS)
- Product Requirements Document (PRD)
- Technical Design Document (TDD)
- API Specification (OpenAPI)
- Site Reliability Engineering (SRE) docs

**Output Quality Metrics**:
- Completeness score
- Clarity index
- Technical accuracy
- Testability rating

### Architect Agent

**Phase**: Technical Architecture

**Capabilities**:
- Designs system architecture
- Selects appropriate design patterns
- Creates infrastructure diagrams
- Defines service boundaries
- Specifies data models

**Architecture Decisions**:
```yaml
decisions:
  - category: "Backend Framework"
    options: ["FastAPI", "Django", "Flask"]
    selected: "FastAPI"
    rationale: "High performance, async support, automatic API docs"
    
  - category: "Database"
    options: ["PostgreSQL", "MongoDB", "DynamoDB"]
    selected: "PostgreSQL"
    rationale: "ACID compliance, complex queries, mature ecosystem"
    
  - category: "Deployment"
    options: ["Kubernetes", "Docker Swarm", "Serverless"]
    selected: "Kubernetes"
    rationale: "Scalability, orchestration, industry standard"
```

### Scaffolder Agent

**Phase**: Development Setup

**Capabilities**:
- Creates project structure
- Sets up build configurations
- Initializes version control
- Configures CI/CD pipelines
- Establishes development environment

**Scaffolding Templates**:
```typescript
interface ScaffoldTemplate {
  name: string;
  structure: {
    directories: string[];
    files: FileTemplate[];
    configurations: ConfigFile[];
  };
  dependencies: Dependency[];
  scripts: ScriptCommand[];
  gitignore: string[];
}
```

## Technology-Specific Agents

### Python Agent

**Specializations**:
- Web frameworks (Django, FastAPI, Flask)
- Data science (Pandas, NumPy, Scikit-learn)
- Automation (Selenium, Requests, BeautifulSoup)
- AI/ML (TensorFlow, PyTorch, Transformers)

**Code Generation Patterns**:
```python
# FastAPI endpoint pattern
@router.post("/items/", response_model=ItemResponse)
async def create_item(
    item: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ItemResponse:
    """
    Create a new item with proper validation and error handling.
    """
    try:
        db_item = ItemModel(**item.dict(), owner_id=current_user.id)
        db.add(db_item)
        await db.commit()
        return ItemResponse.from_orm(db_item)
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Item already exists")
```

### Vue Agent

**Specializations**:
- Vue 3 Composition API
- Vuex/Pinia state management
- Vue Router configuration
- Component libraries (Vuetify, Element Plus)
- Testing (Vitest, Cypress)

**Component Generation Pattern**:
```vue
<template>
  <div class="component-container">
    <slot name="header" />
    <div class="content">
      {{ processedData }}
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '@/stores'
import type { DataType } from '@/types'

const props = defineProps<{
  data: DataType
  options?: Options
}>()

const emit = defineEmits<{
  update: [value: DataType]
  error: [error: Error]
}>()

const store = useStore()
const processedData = computed(() => 
  processData(props.data, props.options)
)
</script>
```

### React Agent

**Specializations**:
- React 18+ features
- Redux/Zustand state management
- Next.js framework
- Material-UI/Ant Design
- Testing (Jest, React Testing Library)

**Hook Pattern Example**:
```typescript
const useDataFetch = <T>(url: string, options?: FetchOptions) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch(url, options)
        if (!response.ok) throw new Error(response.statusText)
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [url])
  
  return { data, loading, error, refetch: fetchData }
}
```

### Database Agent

**Supported Databases**:
- PostgreSQL
- MySQL/MariaDB
- MongoDB
- Redis
- Elasticsearch

**Schema Generation**:
```sql
-- PostgreSQL schema with best practices
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

## Support Agents

### Git Agent

**Capabilities**:
- Repository initialization
- Branch management
- Commit creation with semantic messages
- Pull request generation
- Merge conflict resolution
- Tag and release management

**Commit Message Pattern**:
```
<type>(<scope>): <subject>

<body>

<footer>

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(auth): implement JWT authentication

- Add JWT token generation
- Implement refresh token mechanism
- Add authentication middleware
- Update user model with token fields

Closes #123
```

### Documentation Agent

**Documentation Types**:
- README files
- API documentation
- Code comments
- Architecture diagrams
- User guides
- Deployment instructions

**README Template**:
```markdown
# Project Name

## Overview
Brief description of what the project does

## Features
- Feature 1
- Feature 2

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`javascript
import { Component } from 'package'
\`\`\`

## API Reference
### Endpoints
- GET /api/resource
- POST /api/resource

## Contributing
Guidelines for contributors

## License
MIT
```

### Code Review Agent

**Review Criteria**:
- Code style compliance
- Security vulnerabilities
- Performance issues
- Best practices adherence
- Test coverage
- Documentation completeness

**Review Output**:
```json
{
  "summary": {
    "score": 85,
    "status": "approved_with_suggestions"
  },
  "issues": [
    {
      "severity": "warning",
      "file": "src/api/handlers.py",
      "line": 45,
      "message": "Consider using async/await for I/O operations",
      "suggestion": "async def fetch_data()..."
    }
  ],
  "metrics": {
    "complexity": 12,
    "coverage": 78,
    "duplicateLines": 3
  }
}
```

### Testing Agent

**Test Generation**:
- Unit tests
- Integration tests
- E2E tests
- Performance tests
- Security tests

**Test Pattern Example**:
```python
import pytest
from unittest.mock import Mock, patch

class TestUserService:
    @pytest.fixture
    def user_service(self):
        return UserService()
    
    @pytest.mark.asyncio
    async def test_create_user_success(self, user_service):
        # Arrange
        user_data = {"email": "test@example.com", "name": "Test User"}
        
        # Act
        with patch('app.database.save') as mock_save:
            mock_save.return_value = {"id": "123", **user_data}
            result = await user_service.create_user(user_data)
        
        # Assert
        assert result["id"] == "123"
        assert result["email"] == user_data["email"]
        mock_save.assert_called_once_with(user_data)
```

## Agent Communication Protocol

### Message Format
```typescript
interface AgentMessage {
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast';
  timestamp: Date;
  payload: {
    action: string;
    data: any;
    context: Context;
    priority: 'low' | 'normal' | 'high';
  };
  metadata: {
    correlationId: string;
    sessionId: string;
    retryCount?: number;
  };
}
```

### Handoff Protocol
```typescript
interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  artifact: {
    type: string;
    content: any;
    validation: ValidationResult;
  };
  nextSteps: string[];
  context: {
    completed: string[];
    pending: string[];
    blockers: string[];
  };
}
```

## Performance Metrics

### Agent Performance KPIs
```typescript
interface AgentMetrics {
  efficiency: {
    tasksCompleted: number;
    averageCompletionTime: number;
    successRate: number;
  };
  quality: {
    codeQualityScore: number;
    documentationScore: number;
    testCoverage: number;
  };
  collaboration: {
    handoffSuccess: number;
    communicationLatency: number;
    conflictResolution: number;
  };
  evolution: {
    promptVersion: number;
    improvementRate: number;
    adaptationScore: number;
  };
}
```

## Agent Lifecycle Management

### States
1. **Idle**: Agent created but not active
2. **Initializing**: Loading context and tools
3. **Active**: Processing tasks
4. **Waiting**: Blocked on dependencies
5. **Terminating**: Cleanup and shutdown

### Resource Management
```typescript
interface AgentResources {
  memory: {
    limit: number; // MB
    current: number;
    peak: number;
  };
  cpu: {
    limit: number; // percentage
    current: number;
    average: number;
  };
  tokens: {
    limit: number;
    used: number;
    remaining: number;
  };
  timeout: {
    task: number; // seconds
    session: number;
  };
}
```

## Conclusion

These agent specifications define a comprehensive ecosystem of specialized AI agents that work together to transform ideas into fully functional applications. Each agent has clear responsibilities, defined interfaces, and measurable performance metrics, enabling the Dev-Ex platform to deliver high-quality software development automation.