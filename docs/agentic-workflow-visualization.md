# Agentic Workflow System - Complete Architecture

## System Overview

The Dev-Ex Agentic Workflow System transforms ideas into fully functional applications through autonomous AI agents working in coordinated workflows.

## Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface"
        UI[Vue.js Frontend]
        WD[Workflow Dashboard]
        WG[Widget System]
    end
    
    subgraph "API Layer"
        GRPC[gRPC Server]
        WS[Workflow Service]
        CS[Chat Service]
    end
    
    subgraph "Agent Ecosystem"
        AM[Agent Manager]
        APM[Agent Pool Maker<br/>Agent 0]
        AD[Agent Darwin<br/>Evolution System]
        WO[Workflow Orchestrator]
    end
    
    subgraph "Core Agents"
        ARCH[Architect]
        BE[Backend Dev]
        FE[Frontend Dev]
        QA[QA Engineer]
        DO[DevOps]
        TW[Technical Writer]
    end
    
    subgraph "Infrastructure"
        MB[Message Bus]
        LM[Lifecycle Manager]
        CC[Collaboration Coordinator]
        SP[State Persistence]
    end
    
    subgraph "Storage"
        PG[(PostgreSQL)]
        RD[(Redis Cache)]
        FS[File System]
    end
    
    UI --> GRPC
    WD --> WS
    WG --> CS
    
    GRPC --> AM
    WS --> WO
    CS --> AM
    
    AM --> APM
    AM --> AD
    AM --> WO
    
    WO --> APM
    WO --> AD
    WO --> MB
    WO --> LM
    
    APM --> ARCH
    APM --> BE
    APM --> FE
    APM --> QA
    APM --> DO
    APM --> TW
    
    AD --> |Monitors| ARCH
    AD --> |Evolves| BE
    AD --> |Optimizes| FE
    
    MB --> CC
    LM --> SP
    
    SP --> PG
    AM --> RD
    LM --> FS
    
    style APM fill:#f9f,stroke:#333,stroke-width:4px
    style AD fill:#9ff,stroke:#333,stroke-width:4px
    style WO fill:#ff9,stroke:#333,stroke-width:4px
```

## Workflow Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend
    participant GRPC as gRPC Server
    participant WO as Workflow Orchestrator
    participant APM as Agent Pool Maker
    participant Agents as Agent Pool
    participant AD as Agent Darwin
    participant MB as Message Bus
    
    User->>UI: "What do you wanna build?"
    UI->>UI: Display widgets for input
    User->>UI: Describe project
    UI->>GRPC: CreateWorkflow(input)
    
    GRPC->>WO: Create workflow
    WO->>APM: Analyze requirements
    APM->>APM: Determine needed agents
    APM->>Agents: Create specialized agents
    APM-->>WO: Agent pool ready
    
    WO->>GRPC: Workflow created
    GRPC-->>UI: Workflow details
    UI-->>User: Show workflow steps
    
    User->>UI: Execute workflow
    UI->>GRPC: ExecuteWorkflow(id)
    
    loop For each workflow phase
        WO->>Agents: Execute phase
        Agents->>MB: Communicate
        MB->>Agents: Coordinate
        Agents->>AD: Report performance
        AD->>AD: Monitor & evolve
        Agents-->>WO: Phase complete
    end
    
    WO-->>GRPC: Execution complete
    GRPC-->>UI: Final results
    UI-->>User: Show generated application
```

## Agent Communication Protocol

```mermaid
graph LR
    subgraph "Message Bus Architecture"
        A1[Agent 1] -->|Send| MB[Message Bus]
        A2[Agent 2] -->|Send| MB
        A3[Agent 3] -->|Send| MB
        
        MB -->|Route| Q1[Queue 1]
        MB -->|Route| Q2[Queue 2]
        MB -->|Route| Q3[Queue 3]
        
        Q1 -->|Receive| A1
        Q2 -->|Receive| A2
        Q3 -->|Receive| A3
    end
    
    subgraph "Message Types"
        MT[Message Types]
        MT --> REQ[REQUEST]
        MT --> RES[RESPONSE]
        MT --> BC[BROADCAST]
        MT --> HO[HANDOFF]
        MT --> SYNC[SYNC]
    end
```

## Workflow Phases

```mermaid
stateDiagram-v2
    [*] --> Brainstorming
    Brainstorming --> Requirements
    Requirements --> Architecture
    Architecture --> Development
    Development --> Testing
    Testing --> Deployment
    Deployment --> Monitoring
    Monitoring --> [*]
    
    state Brainstorming {
        [*] --> IdeaRefinement
        IdeaRefinement --> FeatureAnalysis
        FeatureAnalysis --> [*]
    }
    
    state Development {
        [*] --> Backend
        [*] --> Frontend
        Backend --> Integration
        Frontend --> Integration
        Integration --> [*]
    }
    
    state Testing {
        [*] --> UnitTests
        UnitTests --> IntegrationTests
        IntegrationTests --> E2ETests
        E2ETests --> [*]
    }
```

## Agent Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> INITIALIZING
    INITIALIZING --> READY
    READY --> RUNNING
    RUNNING --> PAUSED
    PAUSED --> RUNNING
    RUNNING --> SUSPENDED
    SUSPENDED --> READY
    RUNNING --> TERMINATING
    TERMINATING --> TERMINATED
    TERMINATED --> [*]
    
    INITIALIZING --> ERROR
    RUNNING --> ERROR
    ERROR --> READY
    ERROR --> TERMINATING
```

## Performance Evolution System

```mermaid
graph TB
    subgraph "Agent Darwin Evolution"
        PM[Performance Monitor] --> MA[Metrics Analysis]
        MA --> ES{Evolution Strategy}
        
        ES -->|Score < 0.5| MUT[Mutation]
        ES -->|Score 0.5-0.7| EXP[Expansion]
        ES -->|Score > 0.7| OPT[Optimization]
        ES -->|Score > 0.9| PRUNE[Pruning]
        
        MUT --> NP[New Prompt]
        EXP --> NP
        OPT --> NP
        PRUNE --> NP
        
        NP --> TEST[Test Version]
        TEST --> COMP[Compare]
        COMP -->|Better| APPLY[Apply Evolution]
        COMP -->|Worse| REVERT[Keep Original]
    end
```

## Technology Stack

```mermaid
mindmap
  root((Dev-Ex Platform))
    Frontend
      Vue.js 3
      TypeScript
      Pinia Store
      TailwindCSS
      Vite
    Backend
      Python 3.11
      gRPC
      FastAPI
      Async/Await
    AI/ML
      Google Gemini
      LangChain
      Vector Embeddings
      pgvector
    Infrastructure
      Docker
      PostgreSQL
      Redis
      GitHub Actions
    Agents
      Agent Pool Maker
      Agent Darwin
      Specialized Agents
      MCP Servers
```

## Data Flow

```mermaid
flowchart LR
    subgraph Input
        UI[User Input]
        W[Widgets]
        F[Files]
    end
    
    subgraph Processing
        WO[Workflow Orchestrator]
        AP[Agent Pool]
        MB[Message Bus]
    end
    
    subgraph Storage
        PG[(PostgreSQL)]
        RD[(Redis)]
        FS[File System]
    end
    
    subgraph Output
        CODE[Generated Code]
        DOC[Documentation]
        TEST[Tests]
        DEPLOY[Deployment]
    end
    
    UI --> W
    W --> WO
    F --> WO
    
    WO --> AP
    AP --> MB
    MB --> AP
    
    AP --> PG
    AP --> RD
    AP --> FS
    
    PG --> CODE
    FS --> CODE
    CODE --> DOC
    CODE --> TEST
    TEST --> DEPLOY
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer]
        
        subgraph "Application Tier"
            FE1[Frontend Instance 1]
            FE2[Frontend Instance 2]
            API1[gRPC Server 1]
            API2[gRPC Server 2]
        end
        
        subgraph "Agent Tier"
            AM1[Agent Manager 1]
            AM2[Agent Manager 2]
            WO1[Orchestrator 1]
            WO2[Orchestrator 2]
        end
        
        subgraph "Data Tier"
            PG[(PostgreSQL<br/>Primary)]
            PGR[(PostgreSQL<br/>Replica)]
            RD[(Redis Cluster)]
        end
        
        subgraph "Monitoring"
            PROM[Prometheus]
            GRAF[Grafana]
            LOG[Logging]
        end
    end
    
    LB --> FE1
    LB --> FE2
    FE1 --> API1
    FE2 --> API2
    API1 --> AM1
    API2 --> AM2
    AM1 --> WO1
    AM2 --> WO2
    
    WO1 --> PG
    WO2 --> PG
    PG --> PGR
    
    AM1 --> RD
    AM2 --> RD
    
    API1 --> PROM
    API2 --> PROM
    PROM --> GRAF
    
    style LB fill:#ff9,stroke:#333,stroke-width:2px
    style PG fill:#9f9,stroke:#333,stroke-width:2px
    style RD fill:#f99,stroke:#333,stroke-width:2px
```

## Key Features

### 1. Dynamic Agent Creation

- **Agent Pool Maker (Agent 0)** analyzes project requirements
- Creates specialized agents based on technology stack
- Assigns responsibilities and dependencies

### 2. Intelligent Orchestration

- **Workflow Orchestrator** coordinates multi-phase execution
- Manages agent lifecycle and state
- Handles parallel and sequential execution

### 3. Real-time Evolution

- **Agent Darwin** monitors performance metrics
- Applies evolutionary strategies for improvement
- Maintains prompt versioning and rollback

### 4. Inter-agent Communication

- **Message Bus** enables agent collaboration
- Supports multiple message patterns
- Provides collaboration coordination

### 5. State Management

- **Lifecycle Manager** tracks agent states
- Persistent storage with checkpoints
- Recovery and rollback capabilities

## Supported Project Types

| Project Type | Agents Used | Estimated Time | Complexity |
|-------------|------------|----------------|------------|
| Web Application | Architect, Backend, Frontend, QA, DevOps | 2-4 weeks | High |
| API Service | Architect, Backend, Database, QA | 1-2 weeks | Medium |
| Documentation | Architect, Technical Writer | 3-5 days | Low |
| Mobile App | Architect, Mobile Dev, Backend, QA | 3-5 weeks | High |
| Data Pipeline | Architect, Data Engineer, QA | 1-2 weeks | Medium |

## Performance Metrics

```mermaid
graph LR
    subgraph "Agent Metrics"
        TCR[Task Completion Rate]
        ART[Avg Response Time]
        ER[Error Rate]
        QS[Quality Score]
        OS[Overall Score]
    end
    
    TCR --> OS
    ART --> OS
    ER --> OS
    QS --> OS
    
    OS --> EV{Evolution Decision}
    EV -->|< 0.5| URGENT[Urgent Evolution]
    EV -->|0.5-0.7| NORMAL[Normal Evolution]
    EV -->|> 0.7| STABLE[Stable]
```

## Future Enhancements

1. **MCP Server Integration** - Connect to external documentation sources
2. **Workflow Templates** - Pre-built workflows for common projects
3. **Multi-tenant Support** - Isolated environments for teams
4. **Advanced Analytics** - Detailed performance insights
5. **Plugin System** - Extensible agent capabilities
6. **Cloud Deployment** - Scalable cloud infrastructure

## Conclusion

The Dev-Ex Agentic Workflow System represents a paradigm shift in software development, where AI agents collaborate to transform ideas into reality. Through dynamic agent creation, intelligent orchestration, and continuous evolution, the system delivers complete applications from simple text descriptions.

**"What do you wanna build today?"** - The question that starts the journey from idea to deployment.