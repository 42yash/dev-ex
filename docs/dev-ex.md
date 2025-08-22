# **Dev-Ex Platform: Comprehensive Technical Documentation**
## **Autonomous Development Platform & Modular Documentation Q&A System**

**Version:** 2.0  
**Last Updated:** December 2024  
**Document Status:** Production Specification

---

## **Executive Summary**

This document presents the complete technical specification for Dev-Ex, a dual-purpose system comprising:

1. **The Autonomous Development Platform ("The Factory")** - An AI-agent orchestration system that automates the software development lifecycle from ideation to scaffolding
2. **The Documentation Q&A Application ("The Product")** - A modular, conversational AI guide for technical documentation, serving as both the first product and proof-of-concept for the platform

The architecture emphasizes modularity, extensibility, and user control, implementing a "human-in-the-loop" approach where AI agents accelerate development while users maintain decision authority.

---

# **Part 1: The Autonomous Development Platform**

## **1.0 Platform Architecture Overview**

### **1.1 Core Philosophy**

The platform operates on three fundamental principles:

- **Modularity:** Each agent is a discrete, replaceable unit with defined inputs/outputs
- **User Sovereignty:** All major decisions require explicit user approval
- **Self-Improvement:** The platform can generate and refine its own agent specifications

### **1.2 System Components**

```
┌─────────────────────────────────────────────────────────────┐
│                     Orchestration Layer                       │
│                         (n8n Engine)                          │
├─────────────────────────────────────────────────────────────┤
│                      Agent Pipeline                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Architect │→ │   Idea   │→ │Technical │→ │Scaffold  │   │
│  │  Agent   │  │Generator │  │   Doc    │  │  Agent   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Support Infrastructure                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Message  │  │  State   │  │  Vector  │  │Approval  │   │
│  │  Queue   │  │  Store   │  │Database  │  │ Webhook  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## **2.0 Orchestration Engine**

### **2.1 n8n Configuration**

The orchestration layer uses n8n for visual workflow management and execution.

**Core Workflow Components:**

```yaml
workflow:
  name: "autonomous-development-pipeline"
  trigger: webhook
  nodes:
    - type: webhook
      name: project_initiation
      path: /api/v1/project/start
      
    - type: http_request
      name: call_architect_agent
      method: POST
      url: http://architect-agent:8000/generate
      
    - type: wait
      name: user_approval_checkpoint
      webhook_path: /api/v1/approve/{executionId}
      timeout: 3600
      
    - type: conditional
      name: approval_check
      conditions:
        - approved: continue_pipeline
        - rejected: terminate_with_feedback
```

### **2.2 Inter-Agent Communication Protocol**

All agents communicate via standardized JSON-RPC 2.0 messages:

```json
{
  "jsonrpc": "2.0",
  "method": "agent.execute",
  "params": {
    "input": {},
    "context": {
      "session_id": "uuid",
      "user_id": "uuid",
      "previous_agents": []
    },
    "config": {
      "model": "gemini-pro",
      "temperature": 0.7,
      "max_tokens": 4096
    }
  },
  "id": "request_id"
}
```

### **2.3 State Management**

**Redis-based State Store:**

```python
class AgentStateManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 86400  # 24 hours
    
    def save_state(self, session_id: str, agent_name: str, state: dict):
        key = f"session:{session_id}:agent:{agent_name}"
        self.redis.setex(
            key, 
            self.ttl, 
            json.dumps(state)
        )
    
    def get_pipeline_state(self, session_id: str) -> dict:
        pattern = f"session:{session_id}:agent:*"
        keys = self.redis.keys(pattern)
        return {
            key.split(":")[-1]: json.loads(self.redis.get(key))
            for key in keys
        }
```

## **3.0 Core Agent Specifications**

### **3.1 Agent 0: The Architect Agent 🏛️**

**Purpose:** Meta-agent that generates system prompts for all other agents

**System Prompt Template:**

```markdown
You are the Architect Agent, responsible for creating robust, secure system prompts for other agents.

## Core Requirements for Generated Prompts:

1. **Security First**
   - Include input validation rules
   - Define output sanitization requirements
   - Specify rate limiting considerations

2. **Structured Format**
   - Clear role definition
   - Enumerated capabilities and limitations
   - Step-by-step operational workflow
   - Expected input/output schemas

3. **Error Handling**
   - Define fallback behaviors
   - Specify retry logic
   - Include error message templates

## Template Structure:

```
AGENT_NAME: [Name]
VERSION: [Semantic Version]

ROLE:
[Single paragraph role description]

CAPABILITIES:
- [Capability 1]
- [Capability 2]

LIMITATIONS:
- [Limitation 1]
- [Limitation 2]

WORKFLOW:
1. [Step 1]
2. [Step 2]

INPUT_SCHEMA:
[JSON Schema]

OUTPUT_SCHEMA:
[JSON Schema]

ERROR_HANDLING:
[Error scenarios and responses]
```
```

### **3.2 Agent 1: Idea Generation Agent 💡**

**Implementation:**

```python
class IdeaGenerationAgent:
    def __init__(self, llm_client):
        self.llm = llm_client
        self.system_prompt = load_prompt("idea_generation.md")
    
    async def execute(self, user_input: str) -> dict:
        # Stage 1: Explore the problem space
        exploration = await self.explore_concept(user_input)
        
        # Stage 2: Generate variations
        variations = await self.generate_variations(exploration)
        
        # Stage 3: Evaluate and rank
        ranked_ideas = await self.evaluate_ideas(variations)
        
        # Stage 4: Format for user presentation
        return {
            "primary_idea": ranked_ideas[0],
            "alternatives": ranked_ideas[1:3],
            "refinement_questions": self.generate_questions(ranked_ideas[0])
        }
    
    async def explore_concept(self, input_text: str) -> dict:
        prompt = f"""
        Analyze this concept: {input_text}
        
        Identify:
        1. Core problem being solved
        2. Target audience
        3. Similar existing solutions
        4. Unique value proposition
        """
        return await self.llm.complete(prompt)
```

### **3.3 Agent 2: Technical Documentation Agent ✍️**

**Interactive Documentation Process:**

```python
class TechnicalDocAgent:
    def __init__(self, llm_client, template_engine):
        self.llm = llm_client
        self.templates = template_engine
        self.stages = [
            "idea_refinement",
            "feature_brainstorming",
            "technical_exploration",
            "synthesis",
            "documentation"
        ]
    
    async def execute_stage(self, stage: str, context: dict) -> dict:
        stage_handlers = {
            "idea_refinement": self.refine_idea,
            "feature_brainstorming": self.brainstorm_features,
            "technical_exploration": self.explore_tech_stack,
            "synthesis": self.create_outline,
            "documentation": self.generate_document
        }
        
        handler = stage_handlers.get(stage)
        result = await handler(context)
        
        # Each stage returns data and next questions
        return {
            "stage_output": result,
            "next_questions": self.generate_stage_questions(stage, result),
            "progress": self.stages.index(stage) / len(self.stages)
        }
```

### **3.4 Agent 3: Code Scaffolding Agent 🏗️**

**Dependency Graph and Sub-Agent Management:**

```python
class ScaffoldingOrchestrator:
    def __init__(self):
        self.sub_agents = {
            "api": APIDefinitionAgent(),
            "frontend": FrontendComponentAgent(),
            "backend": BackendServiceAgent(),
            "database": DatabaseSchemaAgent(),
            "docker": ContainerizationAgent(),
            "testing": TestGenerationAgent(),
            "ci_cd": CICDPipelineAgent()
        }
        
        self.dependency_graph = {
            "api": [],
            "database": ["api"],
            "backend": ["api", "database"],
            "frontend": ["api"],
            "docker": ["backend", "frontend"],
            "testing": ["backend", "frontend"],
            "ci_cd": ["docker", "testing"]
        }
    
    async def execute(self, tech_doc: dict) -> dict:
        execution_order = self.topological_sort(self.dependency_graph)
        results = {}
        
        for agent_name in execution_order:
            dependencies = {
                dep: results[dep] 
                for dep in self.dependency_graph[agent_name]
            }
            
            agent = self.sub_agents[agent_name]
            results[agent_name] = await agent.execute(
                tech_doc, 
                dependencies
            )
            
            # User approval checkpoint
            if not await self.get_user_approval(agent_name, results[agent_name]):
                return self.handle_rejection(agent_name, results)
        
        return self.assemble_scaffold(results)
```

## **4.0 Sub-Agent Specifications**

### **4.1 API Definition Agent**

```python
class APIDefinitionAgent:
    async def execute(self, tech_doc: dict, dependencies: dict) -> dict:
        # Extract API requirements from tech doc
        api_spec = self.extract_api_requirements(tech_doc)
        
        # Generate Protocol Buffer definitions
        proto_files = await self.generate_proto_files(api_spec)
        
        # Generate OpenAPI specification
        openapi_spec = await self.generate_openapi(api_spec)
        
        return {
            "proto_files": proto_files,
            "openapi_spec": openapi_spec,
            "service_definitions": self.extract_services(proto_files)
        }
    
    def generate_proto_files(self, spec: dict) -> list:
        proto_template = """
        syntax = "proto3";
        package {package_name};
        
        service {service_name} {{
            {rpc_methods}
        }}
        
        {message_definitions}
        """
        
        protos = []
        for service in spec["services"]:
            proto_content = proto_template.format(
                package_name=spec["package"],
                service_name=service["name"],
                rpc_methods=self.format_rpc_methods(service["methods"]),
                message_definitions=self.format_messages(service["messages"])
            )
            protos.append({
                "filename": f"{service['name'].lower()}.proto",
                "content": proto_content
            })
        
        return protos
```

### **4.2 Database Schema Agent**

```python
class DatabaseSchemaAgent:
    async def execute(self, tech_doc: dict, dependencies: dict) -> dict:
        # Analyze data requirements
        entities = self.extract_entities(tech_doc)
        relationships = self.identify_relationships(entities)
        
        # Generate schema based on database type
        db_type = tech_doc.get("database", {}).get("type", "postgresql")
        
        schema_generators = {
            "postgresql": self.generate_postgres_schema,
            "mongodb": self.generate_mongo_schema,
            "dynamodb": self.generate_dynamo_schema
        }
        
        schema = schema_generators[db_type](entities, relationships)
        
        # Generate migration files
        migrations = self.generate_migrations(schema)
        
        # Generate ORM models
        orm_models = self.generate_orm_models(schema, tech_doc["backend"]["language"])
        
        return {
            "schema": schema,
            "migrations": migrations,
            "orm_models": orm_models,
            "seed_data": self.generate_seed_data(entities)
        }
```

---

# **Part 2: Documentation Q&A Application Architecture**

## **5.0 Application Overview**

### **5.1 System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vue.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Chat   │  │  Widget  │  │ Command  │  │   Dock   │   │
│  │Interface │  │  System  │  │  Center  │  │Component │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    gRPC-Web Proxy Layer                       │
├─────────────────────────────────────────────────────────────┤
│                   API Gateway (Node.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │  Rate    │  │ Request  │  │  Session │   │
│  │ Service  │  │ Limiter  │  │  Router  │  │  Manager │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    gRPC Internal Layer                        │
├─────────────────────────────────────────────────────────────┤
│                   AI Services (Python)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Agent  │  │  Gemini  │  │  Vector  │  │Connector │   │
│  │ Manager  │  │  Client  │  │  Search  │  │  Engine  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │ pgvector │  │  Redis   │  │   S3     │   │
│  │    DB    │  │Extension │  │  Cache   │  │ Storage  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## **6.0 Frontend Implementation**

### **6.1 Vue.js Component Architecture**

```typescript
// Core Application Structure
interface AppState {
  session: SessionState;
  ui: UIState;
  chat: ChatState;
  widgets: WidgetState;
}

// Main App Component
export default defineComponent({
  name: 'DocumentationQA',
  setup() {
    const store = useAppStore();
    const { currentTheme } = useTheme();
    
    const layoutConfig = computed(() => ({
      theme: currentTheme.value,
      layout: store.ui.layout,
      widgets: store.widgets.active
    }));
    
    return {
      layoutConfig,
      handleCommand: (cmd: Command) => store.dispatch('executeCommand', cmd),
      handleWidgetAction: (action: WidgetAction) => store.dispatch('widgetAction', action)
    };
  }
});
```

### **6.2 Dynamic Widget System**

```typescript
// Widget Registry and Manager
class WidgetManager {
  private registry: Map<string, WidgetDefinition> = new Map();
  private activeWidgets: Map<string, WidgetInstance> = new Map();
  
  registerWidget(definition: WidgetDefinition): void {
    this.registry.set(definition.type, definition);
  }
  
  async loadWidget(type: string, config: WidgetConfig): Promise<string> {
    const definition = this.registry.get(type);
    if (!definition) throw new Error(`Unknown widget type: ${type}`);
    
    const instance = await this.createInstance(definition, config);
    const id = nanoid();
    this.activeWidgets.set(id, instance);
    
    return id;
  }
  
  hotSwapWidget(oldId: string, newType: string, config: WidgetConfig): void {
    const oldWidget = this.activeWidgets.get(oldId);
    if (oldWidget) {
      oldWidget.cleanup();
      this.activeWidgets.delete(oldId);
    }
    
    this.loadWidget(newType, config);
  }
}

// Widget Component Examples
const MCQSelectorWidget = defineComponent({
  props: ['options', 'onSelect'],
  template: `
    <div class="widget-mcq">
      <div v-for="option in options" 
           :key="option.id"
           @click="onSelect(option)"
           class="option-card">
        <h3>{{ option.title }}</h3>
        <p>{{ option.description }}</p>
        <div class="pros-cons">
          <span class="pros">{{ option.pros }}</span>
          <span class="cons">{{ option.cons }}</span>
        </div>
      </div>
    </div>
  `
});
```

### **6.3 Command Center Implementation**

```typescript
class CommandCenter {
  private commands: Map<string, CommandHandler> = new Map();
  private shortcuts: Map<string, string> = new Map();
  
  constructor() {
    this.registerDefaultCommands();
    this.setupKeyboardListeners();
  }
  
  private registerDefaultCommands(): void {
    this.register('search', {
      pattern: /^(search|find)\s+(.+)$/i,
      handler: async (match) => {
        const query = match[2];
        return await this.searchDocumentation(query);
      }
    });
    
    this.register('switch-connector', {
      pattern: /^switch\s+to\s+(\w+)$/i,
      handler: async (match) => {
        const connector = match[1];
        return await this.switchConnector(connector);
      }
    });
  }
  
  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.open();
      }
    });
  }
}
```

## **7.0 Backend Services**

### **7.1 API Gateway (Node.js with Fastify)**

```typescript
// Main Gateway Server
import fastify from 'fastify';
import { grpcPlugin } from './plugins/grpc';
import { authPlugin } from './plugins/auth';
import { rateLimitPlugin } from './plugins/rateLimit';

const server = fastify({
  logger: true,
  trustProxy: true
});

// Register plugins
server.register(grpcPlugin, {
  protoPath: './protos',
  services: {
    chat: 'localhost:50051',
    docs: 'localhost:50052',
    connector: 'localhost:50053'
  }
});

server.register(authPlugin, {
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiry: '24h'
});

server.register(rateLimitPlugin, {
  max: 100,
  timeWindow: '1 minute'
});

// Authentication endpoints
server.post('/auth/register', async (request, reply) => {
  const { email, password } = request.body;
  const user = await userService.register(email, password);
  const token = server.jwt.sign({ id: user.id, email: user.email });
  return { user, token };
});

// gRPC-Web proxy endpoints
server.post('/grpc/*', {
  preHandler: server.authenticate,
  handler: async (request, reply) => {
    const service = request.params['*'].split('/')[0];
    const method = request.params['*'].split('/')[1];
    
    const grpcClient = server.grpc[service];
    const response = await grpcClient[method](request.body);
    
    return response;
  }
});
```

### **7.2 Session Management**

```typescript
class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private redis: RedisClient;
  
  async createSession(userId: string): Promise<Session> {
    const session = {
      id: nanoid(),
      userId,
      createdAt: Date.now(),
      messages: [],
      context: {},
      activeConnector: 'aws'
    };
    
    this.sessions.set(session.id, session);
    await this.redis.setex(
      `session:${session.id}`,
      3600,
      JSON.stringify(session)
    );
    
    return session;
  }
  
  async appendMessage(sessionId: string, message: Message): Promise<void> {
    const session = await this.getSession(sessionId);
    session.messages.push(message);
    
    await this.updateSession(session);
    
    // Trigger async processing
    this.eventBus.emit('message:added', { sessionId, message });
  }
}
```

## **8.0 AI Services (Python)**

### **8.1 Agent Manager**

```python
class AgentManager:
    def __init__(self, gemini_client, vector_store, connector_engine):
        self.llm = gemini_client
        self.vector_store = vector_store
        self.connectors = connector_engine
        self.agents = {}
    
    async def create_agent(self, session_id: str) -> ConversationalAgent:
        """Create a new conversational agent for a session"""
        agent = ConversationalAgent(
            session_id=session_id,
            llm=self.llm,
            tools=[
                QueryDocsTool(self.vector_store),
                SwitchConnectorTool(self.connectors),
                GenerateCodeTool(),
                EstimateCostTool()
            ]
        )
        
        self.agents[session_id] = agent
        return agent
    
    async def process_message(self, session_id: str, message: str) -> dict:
        """Process a user message through the agent pipeline"""
        agent = self.agents.get(session_id)
        if not agent:
            agent = await self.create_agent(session_id)
        
        # Execute the reasoning loop
        response = await agent.reason_and_act(message)
        
        return {
            "response": response.text,
            "widgets": response.widgets,
            "actions": response.suggested_actions,
            "context": response.context_update
        }
```

### **8.2 Conversational Agent Implementation**

```python
class ConversationalAgent:
    def __init__(self, session_id: str, llm, tools: List[Tool]):
        self.session_id = session_id
        self.llm = llm
        self.tools = {tool.name: tool for tool in tools}
        self.conversation_history = []
        self.current_pathway = None
    
    async def reason_and_act(self, user_message: str) -> AgentResponse:
        """Execute the reason-act loop"""
        
        # Add message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        
        # Reasoning phase
        reasoning_prompt = self.build_reasoning_prompt(user_message)
        reasoning_result = await self.llm.complete(reasoning_prompt)
        
        # Determine next action
        action = self.parse_action(reasoning_result)
        
        # Execute action
        if action.type == "tool_use":
            tool_result = await self.execute_tool(action.tool, action.params)
            
            # Synthesize response with tool results
            synthesis_prompt = self.build_synthesis_prompt(
                user_message, 
                tool_result
            )
            final_response = await self.llm.complete(synthesis_prompt)
            
        elif action.type == "direct_response":
            final_response = reasoning_result
        
        elif action.type == "interactive_pathway":
            final_response = await self.generate_pathway_options(
                user_message,
                reasoning_result
            )
        
        # Format and return response
        return self.format_response(final_response, action)
    
    async def generate_pathway_options(self, query: str, context: dict) -> dict:
        """Generate interactive pathway options for the user"""
        
        # Query relevant documentation
        docs = await self.tools["query_docs"].execute({
            "query": query,
            "limit": 5
        })
        
        # Generate options based on documentation
        options_prompt = f"""
        Based on the user query: "{query}"
        And the following documentation: {docs}
        
        Generate 3-4 strategic options for the user to choose from.
        Each option should include:
        1. A clear title
        2. Brief description
        3. Pros and cons
        4. Estimated complexity
        5. Cost implications
        
        Format as JSON.
        """
        
        options = await self.llm.complete(options_prompt)
        
        return {
            "type": "pathway_selection",
            "options": json.loads(options),
            "context": self.current_pathway
        }
```

## **9.0 Connector Architecture**

### **9.1 Base Connector Interface**

```python
from abc import ABC, abstractmethod
from typing import Dict, List, Any

class BaseConnector(ABC):
    """Abstract base class for all documentation connectors"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__
        self.vector_store = None
        self.last_sync = None
    
    @abstractmethod
    async def fetch_documentation(self) -> List[Document]:
        """Fetch raw documentation from the source"""
        pass
    
    @abstractmethod
    async def parse_content(self, raw_content: str) -> Document:
        """Parse raw content into structured document"""
        pass
    
    async def sync(self) -> Dict[str, Any]:
        """Full synchronization pipeline"""
        # Fetch latest documentation
        raw_docs = await self.fetch_documentation()
        
        # Parse and clean
        parsed_docs = []
        for raw_doc in raw_docs:
            parsed = await self.parse_content(raw_doc)
            cleaned = self.clean_document(parsed)
            parsed_docs.append(cleaned)
        
        # Chunk documents
        chunks = self.chunk_documents(parsed_docs)
        
        # Generate embeddings
        embeddings = await self.generate_embeddings(chunks)
        
        # Store in vector database
        await self.store_embeddings(embeddings)
        
        self.last_sync = datetime.utcnow()
        
        return {
            "documents_processed": len(parsed_docs),
            "chunks_created": len(chunks),
            "sync_time": self.last_sync
        }
    
    def chunk_documents(self, docs: List[Document]) -> List[Chunk]:
        """Split documents into semantic chunks"""
        chunks = []
        
        for doc in docs:
            # Use LangChain's text splitter for semantic chunking
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
            
            doc_chunks = splitter.split_text(doc.content)
            
            for i, chunk_text in enumerate(doc_chunks):
                chunks.append(Chunk(
                    id=f"{doc.id}_chunk_{i}",
                    document_id=doc.id,
                    content=chunk_text,
                    metadata={
                        **doc.metadata,
                        "chunk_index": i,
                        "total_chunks": len(doc_chunks)
                    }
                ))
        
        return chunks
```

### **9.2 AWS Documentation Connector**

```python
class AWSConnector(BaseConnector):
    """Connector for AWS documentation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = "https://docs.aws.amazon.com"
        self.services_to_track = config.get("services", [])
    
    async def fetch_documentation(self) -> List[Document]:
        """Scrape AWS documentation"""
        documents = []
        
        async with aiohttp.ClientSession() as session:
            # Get service index
            service_urls = await self.get_service_urls(session)
            
            # Fetch each service's documentation
            for service, url in service_urls.items():
                if self.services_to_track and service not in self.services_to_track:
                    continue
                
                service_docs = await self.fetch_service_docs(session, service, url)
                documents.extend(service_docs)
        
        return documents
    
    async def fetch_service_docs(self, session, service: str, url: str) -> List[Document]:
        """Fetch documentation for a specific AWS service"""
        documents = []
        
        async with session.get(url) as response:
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract main content
            content_div = soup.find('div', {'id': 'main-content'})
            if not content_div:
                return documents
            
            # Find all documentation sections
            sections = content_div.find_all(['section', 'article'])
            
            for section in sections:
                doc = Document(
                    id=f"aws_{service}_{hashlib.md5(section.text.encode()).hexdigest()[:8]}",
                    source="aws",
                    service=service,
                    title=section.find('h1', 'h2').text if section.find('h1', 'h2') else "Untitled",
                    content=self.extract_text(section),
                    metadata={
                        "url": url,
                        "service": service,
                        "last_updated": datetime.utcnow().isoformat(),
                        "type": "documentation"
                    }
                )
                documents.append(doc)
        
        return documents
    
    async def parse_content(self, raw_content: Document) -> Document:
        """Parse and enhance AWS documentation content"""
        
        # Extract code examples
        raw_content.code_examples = self.extract_code_examples(raw_content.content)
        
        # Extract pricing information
        raw_content.pricing_info = await self.extract_pricing_info(raw_content.service)
        
        # Extract related services
        raw_content.related_services = self.extract_related_services(raw_content.content)
        
        return raw_content
```

### **9.3 Custom Documentation Connector Template**

```python
class CustomConnector(BaseConnector):
    """Template for creating custom documentation connectors"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_endpoint = config.get("api_endpoint")
        self.auth_token = config.get("auth_token")
    
    async def fetch_documentation(self) -> List[Document]:
        """
        Implement custom fetching logic here
        Examples:
        - REST API calls
        - GraphQL queries
        - File system reads
        - Database queries
        """
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.api_endpoint, headers=headers) as response:
                data = await response.json()
                
                documents = []
                for item in data["documents"]:
                    doc = Document(
                        id=item["id"],
                        source=self.name,
                        title=item["title"],
                        content=item["content"],
                        metadata=item.get("metadata", {})
                    )
                    documents.append(doc)
                
                return documents
    
    async def parse_content(self, raw_content: Document) -> Document:
        """Implement custom parsing logic"""
        # Custom parsing based on your documentation format
        return raw_content
```

## **10.0 Vector Database Implementation**

### **10.1 PostgreSQL with pgvector**

```sql
-- Database schema for vector storage
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_name VARCHAR(100) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connector_name, source_id)
);

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- Dimension based on embedding model
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, chunk_index)
);

-- Indexes for efficient search
CREATE INDEX idx_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_documents_connector ON documents(connector_name);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);
```

### **10.2 Vector Store Manager**

```python
class VectorStoreManager:
    def __init__(self, db_config: dict, embedding_model):
        self.pool = asyncpg.create_pool(**db_config)
        self.embedding_model = embedding_model
    
    async def store_document(self, doc: Document, chunks: List[Chunk]):
        """Store document and its chunks with embeddings"""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Insert document
                doc_id = await conn.fetchval("""
                    INSERT INTO documents (connector_name, source_id, title, content, metadata)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (connector_name, source_id) 
                    DO UPDATE SET 
                        title = EXCLUDED.title,
                        content = EXCLUDED.content,
                        metadata = EXCLUDED.metadata,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                """, doc.connector, doc.source_id, doc.title, doc.content, json.dumps(doc.metadata))
                
                # Generate embeddings for chunks
                chunk_texts = [chunk.content for chunk in chunks]
                embeddings = await self.embedding_model.embed_batch(chunk_texts)
                
                # Insert chunks with embeddings
                for chunk, embedding in zip(chunks, embeddings):
                    await conn.execute("""
                        INSERT INTO document_chunks (document_id, chunk_index, content, embedding, metadata)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (document_id, chunk_index)
                        DO UPDATE SET
                            content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding,
                            metadata = EXCLUDED.metadata
                    """, doc_id, chunk.index, chunk.content, embedding, json.dumps(chunk.metadata))
    
    async def semantic_search(self, query: str, connector: str = None, limit: int = 10) -> List[SearchResult]:
        """Perform semantic search across documents"""
        # Generate query embedding
        query_embedding = await self.embedding_model.embed(query)
        
        async with self.pool.acquire() as conn:
            # Build query with optional connector filter
            sql = """
                SELECT 
                    c.id,
                    c.content,
                    c.metadata,
                    d.title,
                    d.connector_name,
                    c.embedding <=> $1 as distance
                FROM document_chunks c
                JOIN documents d ON c.document_id = d.id
            """
            
            params = [query_embedding]
            if connector:
                sql += " WHERE d.connector_name = $2"
                params.append(connector)
            
            sql += " ORDER BY distance LIMIT $" + str(len(params) + 1)
            params.append(limit)
            
            rows = await conn.fetch(sql, *params)
            
            return [
                SearchResult(
                    chunk_id=row['id'],
                    content=row['content'],
                    metadata=json.loads(row['metadata']),
                    document_title=row['title'],
                    connector=row['connector_name'],
                    similarity_score=1 - row['distance']
                )
                for row in rows
            ]
```

---

# **Part 3: Implementation Details**

## **11.0 Protocol Buffer Definitions**

### **11.1 Core Service Definitions**

```protobuf
syntax = "proto3";
package devex.api.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";

// Chat Service
service ChatService {
    rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
    rpc StreamResponse(StreamRequest) returns (stream StreamResponse);
    rpc GetHistory(GetHistoryRequest) returns (GetHistoryResponse);
}

message SendMessageRequest {
    string session_id = 1;
    string message = 2;
    map<string, string> context = 3;
    MessageOptions options = 4;
}

message MessageOptions {
    bool stream = 1;
    string preferred_connector = 2;
    int32 max_tokens = 3;
}

message SendMessageResponse {
    string response_id = 1;
    string content = 2;
    repeated Widget widgets = 3;
    repeated Action suggested_actions = 4;
    ResponseMetadata metadata = 5;
}

message Widget {
    string type = 1;
    string widget_id = 2;
    google.protobuf.Struct config = 3;
    google.protobuf.Struct data = 4;
}

// Documentation Service
service DocumentationService {
    rpc Search(SearchRequest) returns (SearchResponse);
    rpc GetDocument(GetDocumentRequest) returns (GetDocumentResponse);
    rpc ListConnectors(ListConnectorsRequest) returns (ListConnectorsResponse);
    rpc SyncConnector(SyncConnectorRequest) returns (SyncConnectorResponse);
}

message SearchRequest {
    string query = 1;
    string connector = 2;
    SearchOptions options = 3;
}

message SearchOptions {
    int32 limit = 1;
    float similarity_threshold = 2;
    repeated string filter_tags = 3;
}

message SearchResponse {
    repeated SearchResult results = 1;
    SearchMetadata metadata = 2;
}

message SearchResult {
    string chunk_id = 1;
    string content = 2;
    string document_title = 3;
    float similarity_score = 4;
    map<string, string> metadata = 5;
}
```

## **12.0 Security Architecture**

### **12.1 Authentication Flow**

```typescript
// JWT-based authentication implementation
class AuthenticationService {
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;
  
  async authenticate(email: string, password: string): Promise<AuthResponse> {
    // Verify credentials
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedException('Invalid credentials');
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: this.sanitizeUser(user)
    };
  }
  
  private generateAccessToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles
      },
      this.jwtSecret,
      { expiresIn: '1h' }
    );
  }
}
```

### **12.2 API Rate Limiting**

```python
class RateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.limits = {
            "free": {"requests": 100, "window": 3600},
            "pro": {"requests": 1000, "window": 3600},
            "enterprise": {"requests": 10000, "window": 3600}
        }
    
    async def check_limit(self, user_id: str, tier: str = "free") -> bool:
        """Check if user has exceeded rate limit"""
        key = f"rate_limit:{user_id}:{int(time.time() // self.limits[tier]['window'])}"
        
        current = await self.redis.incr(key)
        
        if current == 1:
            await self.redis.expire(key, self.limits[tier]["window"])
        
        if current > self.limits[tier]["requests"]:
            raise RateLimitExceeded(
                f"Rate limit exceeded. Limit: {self.limits[tier]['requests']} requests per hour"
            )
        
        return True
```

### **12.3 Input Validation and Sanitization**

```python
from pydantic import BaseModel, validator
import bleach

class MessageInput(BaseModel):
    session_id: str
    content: str
    connector: Optional[str] = None
    
    @validator('content')
    def sanitize_content(cls, v):
        # Remove any HTML/script tags
        cleaned = bleach.clean(v, tags=[], strip=True)
        
        # Limit message length
        if len(cleaned) > 10000:
            raise ValueError("Message too long (max 10000 characters)")
        
        return cleaned
    
    @validator('session_id')
    def validate_session_id(cls, v):
        # Ensure session ID is valid UUID
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("Invalid session ID format")
        return v
```

## **13.0 Testing Framework**

### **13.1 Unit Testing**

```python
# Python unit tests for AI agents
import pytest
from unittest.mock import Mock, AsyncMock

class TestConversationalAgent:
    @pytest.fixture
    def agent(self):
        mock_llm = AsyncMock()
        mock_tools = [Mock(name="test_tool")]
        return ConversationalAgent("test_session", mock_llm, mock_tools)
    
    @pytest.mark.asyncio
    async def test_reason_and_act_with_tool_use(self, agent):
        # Setup
        agent.llm.complete.return_value = {
            "action": "tool_use",
            "tool": "test_tool",
            "params": {"query": "test"}
        }
        
        # Execute
        response = await agent.reason_and_act("Test message")
        
        # Assert
        assert response.type == "tool_response"
        agent.llm.complete.assert_called()
```

```typescript
// TypeScript unit tests for frontend
describe('WidgetManager', () => {
  let widgetManager: WidgetManager;
  
  beforeEach(() => {
    widgetManager = new WidgetManager();
  });
  
  describe('loadWidget', () => {
    it('should load and register a widget', async () => {
      // Arrange
      const mockDefinition = {
        type: 'mcq-selector',
        component: MCQSelectorWidget
      };
      widgetManager.registerWidget(mockDefinition);
      
      // Act
      const widgetId = await widgetManager.loadWidget('mcq-selector', {
        options: []
      });
      
      // Assert
      expect(widgetId).toBeDefined();
      expect(widgetManager.getWidget(widgetId)).toBeDefined();
    });
  });
});
```

### **13.2 Integration Testing**

```python
# Integration test for the complete pipeline
class TestDocumentationPipeline:
    @pytest.mark.integration
    async def test_end_to_end_documentation_query(self):
        # Setup
        connector = AWSConnector({"services": ["s3"]})
        vector_store = VectorStoreManager(test_db_config)
        agent_manager = AgentManager(gemini_client, vector_store, connector)
        
        # Sync documentation
        await connector.sync()
        
        # Create session and agent
        session = await agent_manager.create_session("test_user")
        
        # Send query
        response = await agent_manager.process_message(
            session.id,
            "How do I host a static website on AWS?"
        )
        
        # Assertions
        assert "S3" in response["response"]
        assert response["widgets"][0]["type"] == "pathway_selection"
        assert len(response["widgets"][0]["data"]["options"]) >= 2
```

## **14.0 Monitoring and Observability**

### **14.1 Logging Strategy**

```python
import structlog
from opentelemetry import trace

# Configure structured logging
logger = structlog.get_logger()

class ObservableAgent:
    def __init__(self):
        self.tracer = trace.get_tracer(__name__)
        self.logger = logger.bind(component="agent")
    
    async def process_with_telemetry(self, message: str):
        with self.tracer.start_as_current_span("process_message") as span:
            span.set_attribute("message.length", len(message))
            
            try:
                self.logger.info(
                    "processing_message",
                    session_id=self.session_id,
                    message_preview=message[:100]
                )
                
                result = await self.process(message)
                
                span.set_attribute("response.widget_count", len(result.widgets))
                self.logger.info(
                    "message_processed",
                    session_id=self.session_id,
                    response_type=result.type,
                    duration_ms=span.duration
                )
                
                return result
                
            except Exception as e:
                span.record_exception(e)
                self.logger.error(
                    "processing_failed",
                    session_id=self.session_id,
                    error=str(e),
                    exc_info=True
                )
                raise
```

### **14.2 Metrics Collection**

```python
from prometheus_client import Counter, Histogram, Gauge

# Define metrics
message_counter = Counter(
    'chat_messages_total',
    'Total number of chat messages processed',
    ['connector', 'status']
)

response_time = Histogram(
    'chat_response_duration_seconds',
    'Time taken to generate response',
    ['connector', 'response_type']
)

active_sessions = Gauge(
    'active_sessions',
    'Number of active chat sessions'
)

vector_search_latency = Histogram(
    'vector_search_duration_seconds',
    'Time taken for vector similarity search',
    ['connector']
)

# Usage in code
class MetricsMiddleware:
    async def process_message(self, message, next_handler):
        connector = message.get("connector", "default")
        
        with response_time.labels(
            connector=connector,
            response_type="chat"
        ).time():
            try:
                result = await next_handler(message)
                message_counter.labels(
                    connector=connector,
                    status="success"
                ).inc()
                return result
            except Exception as e:
                message_counter.labels(
                    connector=connector,
                    status="error"
                ).inc()
                raise
```

---

# **Part 4: Deployment and Operations**

## **15.0 Deployment Architecture**

### **15.1 Kubernetes Deployment**

```yaml
# Kubernetes deployment manifests
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devex-api-gateway
  namespace: devex
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: gateway
        image: devex/api-gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: devex-secrets
              key: jwt-secret
        - name: REDIS_URL
          value: redis://redis-service:6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: devex
spec:
  selector:
    app: api-gateway
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer

---
# AI Services Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devex-ai-services
  namespace: devex
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-services
  template:
    metadata:
      labels:
        app: ai-services
    spec:
      containers:
      - name: ai-service
        image: devex/ai-services:latest
        ports:
        - containerPort: 50051
          name: grpc
        env:
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: devex-secrets
              key: gemini-api-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: devex-secrets
              key: database-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### **15.2 Docker Compose for Development**

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8080
    volumes:
      - ./frontend:/app
      - /app/node_modules

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
    depends_on:
      - postgres
      - redis

  # n8n Orchestration
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=admin
    volumes:
      - n8n_data:/home/node/.n8n

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

  # Redis
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
  n8n_data:
```

## **16.0 CI/CD Pipeline**

### **16.1 GitHub Actions Workflow**

```yaml
name: DevEx CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: ankane/pgvector
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        cache: 'pip'
    
    - name: Install dependencies
      run: |
        npm ci --prefix frontend
        npm ci --prefix backend/gateway
        pip install -r backend/ai-services/requirements.txt
    
    - name: Run tests
      run: |
        npm test --prefix frontend
        npm test --prefix backend/gateway
        pytest backend/ai-services/tests
    
    - name: Build Docker images
      run: |
        docker build -t devex/frontend:${{ github.sha }} ./frontend
        docker build -t devex/api-gateway:${{ github.sha }} ./backend/gateway
        docker build -t devex/ai-services:${{ github.sha }} ./backend/ai-services

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Push to ECR
      run: |
        aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
        
        docker tag devex/frontend:${{ github.sha }} $ECR_REGISTRY/devex/frontend:latest
        docker tag devex/api-gateway:${{ github.sha }} $ECR_REGISTRY/devex/api-gateway:latest
        docker tag devex/ai-services:${{ github.sha }} $ECR_REGISTRY/devex/ai-services:latest
        
        docker push $ECR_REGISTRY/devex/frontend:latest
        docker push $ECR_REGISTRY/devex/api-gateway:latest
        docker push $ECR_REGISTRY/devex/ai-services:latest
    
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/devex-frontend frontend=$ECR_REGISTRY/devex/frontend:latest
        kubectl set image deployment/devex-api-gateway gateway=$ECR_REGISTRY/devex/api-gateway:latest
        kubectl set image deployment/devex-ai-services ai-service=$ECR_REGISTRY/devex/ai-services:latest
        kubectl rollout status deployment/devex-frontend
        kubectl rollout status deployment/devex-api-gateway
        kubectl rollout status deployment/devex-ai-services
```

## **17.0 Configuration Management**

### **17.1 Environment Configuration**

```typescript
// Configuration schema and validation
import { z } from 'zod';

const ConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
    port: z.number().min(1).max(65535),
  }),
  
  database: z.object({
    host: z.string(),
    port: z.number(),
    name: z.string(),
    user: z.string(),
    password: z.string(),
    ssl: z.boolean().default(false),
  }),
  
  redis: z.object({
    url: z.string().url(),
    ttl: z.number().default(3600),
  }),
  
  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiry: z.string().default('1h'),
    refreshSecret: z.string().min(32),
    refreshExpiry: z.string().default('7d'),
  }),
  
  ai: z.object({
    geminiApiKey: z.string(),
    modelName: z.string().default('gemini-pro'),
    maxTokens: z.number().default(4096),
    temperature: z.number().min(0).max(1).default(0.7),
  }),
  
  rateLimit: z.object({
    windowMs: z.number().default(60000),
    max: z.number().default(100),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

class ConfigurationManager {
  private config: Config;
  
  constructor() {
    this.loadConfiguration();
  }
  
  private loadConfiguration(): void {
    const rawConfig = {
      app: {
        name: process.env.APP_NAME || 'devex',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '8080'),
      },
      // ... rest of configuration
    };
    
    try {
      this.config = ConfigSchema.parse(rawConfig);
    } catch (error) {
      console.error('Configuration validation failed:', error);
      process.exit(1);
    }
  }
  
  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }
}
```

## **18.0 Backup and Disaster Recovery**

### **18.1 Database Backup Strategy**

```bash
#!/bin/bash
# Automated backup script for PostgreSQL with pgvector

set -e

# Configuration
DB_NAME="devex"
DB_USER="devex"
BACKUP_DIR="/backups"
S3_BUCKET="devex-backups"
RETENTION_DAYS=30

# Create backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/devex_backup_$TIMESTAMP.sql.gz"

echo "Starting backup at $(date)"

# Dump database including vector data
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  --verbose \
  --no-owner \
  --no-privileges \
  | gzip > $BACKUP_FILE

echo "Backup completed: $BACKUP_FILE"

# Upload to S3
aws s3 cp $BACKUP_FILE s3://$S3_BUCKET/postgres/

# Clean up old local backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Clean up old S3 backups
aws s3 ls s3://$S3_BUCKET/postgres/ \
  | awk '{print $4}' \
  | while read -r file; do
    FILE_DATE=$(echo $file | grep -oP '\d{8}')
    if [[ $(date -d "$FILE_DATE" +%s) -lt $(date -d "$RETENTION_DAYS days ago" +%s) ]]; then
      aws s3 rm s3://$S3_BUCKET/postgres/$file
    fi
  done

echo "Backup process completed at $(date)"
```

### **18.2 Disaster Recovery Plan**

```python
class DisasterRecoveryManager:
    """Manages disaster recovery procedures"""
    
    def __init__(self):
        self.backup_locations = {
            "primary": "s3://devex-backups",
            "secondary": "gs://devex-dr-backups"
        }
        self.recovery_procedures = self.load_recovery_procedures()
    
    async def initiate_recovery(self, incident_type: str):
        """Initiate disaster recovery based on incident type"""
        
        procedure = self.recovery_procedures.get(incident_type)
        if not procedure:
            raise ValueError(f"Unknown incident type: {incident_type}")
        
        recovery_steps = []
        
        # Step 1: Assess damage
        assessment = await self.assess_system_state()
        recovery_steps.append(assessment)
        
        # Step 2: Determine recovery point
        recovery_point = await self.determine_recovery_point(assessment)
        recovery_steps.append(recovery_point)
        
        # Step 3: Execute recovery
        if incident_type == "database_corruption":
            await self.recover_database(recovery_point)
        elif incident_type == "service_failure":
            await self.recover_services(assessment)
        elif incident_type == "complete_outage":
            await self.full_system_recovery(recovery_point)
        
        # Step 4: Validate recovery
        validation = await self.validate_recovery()
        recovery_steps.append(validation)
        
        # Step 5: Generate report
        report = self.generate_recovery_report(recovery_steps)
        
        return report
    
    async def recover_database(self, recovery_point):
        """Restore database from backup"""
        
        # Download backup from S3
        backup_file = await self.download_backup(recovery_point)
        
        # Restore database
        restore_command = f"""
        PGPASSWORD={os.getenv('DB_PASSWORD')} pg_restore \
            -h {os.getenv('DB_HOST')} \
            -U {os.getenv('DB_USER')} \
            -d {os.getenv('DB_NAME')} \
            -c \
            {backup_file}
        """
        
        result = await asyncio.create_subprocess_shell(
            restore_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await result.communicate()
        
        if result.returncode != 0:
            raise Exception(f"Database restore failed: {stderr.decode()}")
        
        # Re-index vector data
        await self.reindex_vector_data()
        
        return {"status": "success", "restored_from": recovery_point}
```

## **19.0 Performance Optimization**

### **19.1 Caching Strategy**

```python
class CacheManager:
    """Multi-layer caching implementation"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.local_cache = {}
        self.cache_layers = [
            ("local", self.local_cache, 60),      # 1 minute local cache
            ("redis", self.redis, 3600),          # 1 hour Redis cache
            ("cdn", None, 86400)                  # 1 day CDN cache
        ]
    
    async def get_with_fallback(self, key: str, fetch_func):
        """Get value with multi-layer fallback"""
        
        # Check each cache layer
        for layer_name, layer_store, _ in self.cache_layers:
            value = await self.get_from_layer(layer_name, key)
            if value is not None:
                # Promote to higher layers
                await self.promote_to_higher_layers(key, value, layer_name)
                return value
        
        # Cache miss - fetch from source
        value = await fetch_func()
        
        # Store in all cache layers
        await self.set_all_layers(key, value)
        
        return value
    
    async def invalidate(self, pattern: str):
        """Invalidate cache entries matching pattern"""
        
        # Clear local cache
        keys_to_delete = [k for k in self.local_cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self.local_cache[key]
        
        # Clear Redis cache
        cursor = 0
        while True:
            cursor, keys = await self.redis.scan(
                cursor, 
                match=f"*{pattern}*", 
                count=100
            )
            
            if keys:
                await self.redis.delete(*keys)
            
            if cursor == 0:
                break
```

### **19.2 Query Optimization**

```sql
-- Optimized vector search with pre-filtering
CREATE OR REPLACE FUNCTION semantic_search_optimized(
    query_embedding vector(1536),
    connector_filter text DEFAULT NULL,
    metadata_filter jsonb DEFAULT NULL,
    result_limit int DEFAULT 10
)
RETURNS TABLE (
    chunk_id uuid,
    content text,
    similarity float,
    metadata jsonb
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_chunks AS (
        SELECT c.*
        FROM document_chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE 
            (connector_filter IS NULL OR d.connector_name = connector_filter)
            AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    )
    SELECT 
        fc.id as chunk_id,
        fc.content,
        1 - (fc.embedding <=> query_embedding) as similarity,
        fc.metadata
    FROM filtered_chunks fc
    ORDER BY fc.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create partial indexes for common queries
CREATE INDEX idx_documents_aws_connector 
ON documents(source_id) 
WHERE connector_name = 'aws';

CREATE INDEX idx_chunks_recent 
ON document_chunks(created_at DESC) 
WHERE created_at > CURRENT_DATE - INTERVAL '7 days';
```

## **20.0 Appendices**

### **Appendix A: Sample n8n Workflow**

```json
{
  "name": "DevEx Agent Pipeline",
  "nodes": [
    {
      "id": "webhook_1",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "path": "project-start",
        "responseMode": "onReceived",
        "options": {}
      }
    },
    {
      "id": "http_1",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [450, 300],
      "parameters": {
        "method": "POST",
        "url": "http://architect-agent:8000/generate",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "input",
              "value": "={{$json[\"input\"]}}"
            }
          ]
        }
      }
    },
    {
      "id": "wait_1",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [650, 300],
      "parameters": {
        "resume": "webhook",
        "options": {
          "webhookSuffix": "approval"
        }
      }
    }
  ],
  "connections": {
    "webhook_1": {
      "main": [
        [
          {
            "node": "http_1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "http_1": {
      "main": [
        [
          {
            "node": "wait_1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

### **Appendix B: Sample Connector Implementation**

```python
# Complete example of a custom connector for internal documentation
class InternalDocsConnector(BaseConnector):
    """Connector for internal company documentation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.confluence_url = config.get("confluence_url")
        self.api_token = config.get("api_token")
        self.spaces_to_index = config.get("spaces", [])
    
    async def fetch_documentation(self) -> List[Document]:
        """Fetch documentation from Confluence"""
        documents = []
        
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Accept": "application/json"
            }
            
            for space in self.spaces_to_index:
                space_docs = await self.fetch_space_content(
                    session, 
                    space, 
                    headers
                )
                documents.extend(space_docs)
        
        return documents
    
    async def fetch_space_content(
        self, 
        session: aiohttp.ClientSession,
        space_key: str,
        headers: dict
    ) -> List[Document]:
        """Fetch all pages from a Confluence space"""
        
        documents = []
        start = 0
        limit = 25
        
        while True:
            url = f"{self.confluence_url}/rest/api/content"
            params = {
                "spaceKey": space_key,
                "type": "page",
                "start": start,
                "limit": limit,
                "expand": "body.storage,version,space"
            }
            
            async with session.get(url, headers=headers, params=params) as response:
                data = await response.json()
                
                for page in data["results"]:
                    doc = Document(
                        id=f"confluence_{page['id']}",
                        source="internal_docs",
                        title=page["title"],
                        content=self.html_to_markdown(page["body"]["storage"]["value"]),
                        metadata={
                            "space": space_key,
                            "version": page["version"]["number"],
                            "last_modified": page["version"]["when"],
                            "url": f"{self.confluence_url}/pages/viewpage.action?pageId={page['id']}"
                        }
                    )
                    documents.append(doc)
                
                if len(data["results"]) < limit:
                    break
                
                start += limit
        
        return documents
    
    def html_to_markdown(self, html: str) -> str:
        """Convert Confluence HTML to Markdown"""
        import html2text
        
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = False
        h.body_width = 0
        
        return h.handle(html)
```

### **Appendix C: Development Setup Guide**

```bash
#!/bin/bash
# Complete development environment setup script

echo "Setting up DevEx development environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }

# Clone repository
git clone https://github.com/your-org/devex.git
cd devex

# Setup environment variables
cp .env.example .env
echo "Please edit .env file with your API keys and configuration"
read -p "Press enter when ready to continue..."

# Install dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "Installing backend dependencies..."
cd backend/gateway
npm install
cd ../..

cd backend/ai-services
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..

# Initialize database
echo "Starting database services..."
docker-compose up -d postgres redis

echo "Waiting for database to be ready..."
sleep 10

echo "Running database migrations..."
docker-compose exec postgres psql -U devex -d devex -f /docker-entrypoint-initdb.d/init.sql

# Start development servers
echo "Starting development servers..."
docker-compose up -d

echo "Development environment setup complete!"
echo "Access the application at http://localhost:3000"
echo "Access n8n at http://localhost:5678 (admin/admin)"
echo "View logs with: docker-compose logs -f"
```

---

## **Conclusion**

This comprehensive technical documentation provides a complete blueprint for implementing the Dev-Ex platform, comprising both the autonomous development platform and the modular documentation Q&A system. The architecture emphasizes:

1. **Modularity** - Every component is replaceable and extensible
2. **Scalability** - Designed to handle growth from prototype to production
3. **Security** - Built-in authentication, authorization, and data protection
4. **Observability** - Comprehensive logging, monitoring, and tracing
5. **Developer Experience** - Clear documentation, testing frameworks, and deployment automation

The system is ready for implementation by a development team, with all major architectural decisions documented and justified. The modular approach ensures that the platform can evolve with changing requirements while maintaining stability and performance.

### **Next Steps**

1. **Phase 1: Core Infrastructure** - Set up development environment, databases, and orchestration
2. **Phase 2: Agent Development** - Implement the core agent pipeline
3. **Phase 3: Application MVP** - Build the documentation Q&A system with AWS connector
4. **Phase 4: Extension** - Add additional connectors and enhance agent capabilities
5. **Phase 5: Production** - Deploy to cloud infrastructure with full monitoring

The platform is designed to be self-improving, with the ability to generate new agents and capabilities as needs evolve, making it a sustainable solution for accelerated software development.