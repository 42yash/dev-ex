# Workflow System Documentation

## Overview

The Dev-Ex platform implements a sophisticated workflow system that orchestrates AI agents to transform user ideas into fully functional applications. This system replaces the originally planned n8n integration with a custom-built workflow engine that provides better control and integration with the agent ecosystem.

## Architecture

### Core Components

#### 1. Workflow Service (gRPC)
**Location**: `backend/ai-services/src/services/workflow_service.py`

The workflow service provides gRPC endpoints for workflow management:
- Create workflows from user input
- Execute workflows with agent orchestration
- Monitor workflow status and progress
- Stream real-time updates to clients
- Pause, resume, and cancel workflows

#### 2. Workflow Orchestrator
**Location**: `backend/ai-services/src/agents/orchestrator.py`

The orchestrator manages workflow execution:
- Coordinates multiple agents
- Manages execution phases
- Handles dependencies between steps
- Tracks workflow state
- Implements circuit breakers and timeouts

#### 3. Agent Pool Maker
**Location**: `backend/ai-services/src/agents/agent_pool_maker.py`

The master orchestrator that:
- Analyzes project requirements
- Determines required agents
- Creates specialized agents dynamically
- Configures agent tools and permissions
- Manages agent lifecycle

#### 4. Agent Darwin
**Location**: `backend/ai-services/src/agents/agent_darwin.py`

The evolution system that:
- Monitors agent performance
- Analyzes success/failure patterns
- Evolves agent prompts
- Optimizes collaboration
- Implements evolutionary strategies

## Workflow Phases

### Phase 1: Requirements Analysis
- User input analysis
- Project type determination
- Technology stack selection
- Feature extraction
- Complexity assessment

### Phase 2: Agent Pool Creation
- Agent requirement analysis
- Dynamic agent instantiation
- Tool configuration
- Dependency setup
- Execution plan creation

### Phase 3: Development Execution
- Parallel agent execution
- Task distribution
- Result aggregation
- Error handling
- Progress tracking

### Phase 4: Quality Assurance
- Code review
- Testing
- Documentation generation
- Performance optimization
- Security scanning

## Workflow Definition

### Proto Definition
**Location**: `proto/workflow.proto`

```protobuf
message WorkflowStep {
    string id = 1;
    string phase = 2;
    string name = 3;
    string description = 4;
    repeated string agents = 5;
    string status = 6;
    google.protobuf.Struct inputs = 7;
    google.protobuf.Struct outputs = 8;
}
```

### Workflow States

| State | Description |
|-------|-------------|
| `created` | Workflow initialized but not started |
| `in_progress` | Workflow actively executing |
| `paused` | Workflow temporarily suspended |
| `completed` | All steps successfully completed |
| `failed` | Workflow encountered unrecoverable error |
| `cancelled` | Workflow manually terminated |

## Frontend Integration

### WorkflowDashboard Component
**Location**: `frontend/src/components/WorkflowDashboard.vue`

Features:
- Real-time workflow visualization
- Progress tracking with step indicators
- Activity log with streaming updates
- Workflow controls (execute, pause, resume, cancel)
- Template-based workflow creation

### Workflow Composable
**Location**: `frontend/src/composables/useWorkflow.ts`

Provides:
- Workflow creation and management
- Real-time update streaming
- State management
- Error handling

## API Endpoints

### gRPC Service Methods

#### CreateWorkflow
Creates a new workflow from user input.
```
Input: user_input, session_id, user_id, options
Output: workflow_id, name, description, steps, status
```

#### ExecuteWorkflow
Starts workflow execution.
```
Input: workflow_id
Output: status, steps_completed, agent_pool, results
```

#### GetWorkflowStatus
Retrieves current workflow status.
```
Input: workflow_id
Output: progress, current_phase, agents, steps
```

#### StreamWorkflowUpdates
Streams real-time workflow updates.
```
Input: workflow_id
Output: stream of WorkflowUpdate messages
```

## Agent Communication

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
}
```

### Execution Context
```python
@dataclass
class AgentContext:
    session_id: str
    user_id: str
    workflow_id: Optional[str]
    variables: Dict[str, Any]
    history: List[Dict[str, Any]]
    metadata: Dict[str, Any]
```

## Performance Optimization

### Execution Limiter
**Location**: `backend/ai-services/src/agents/execution_limiter.py`

Features:
- Configurable timeout per agent
- Maximum retry attempts
- Circuit breaker pattern
- Resource usage tracking
- Graceful degradation

### Parallel Execution
- Independent agents run concurrently
- Task queue management
- Result aggregation
- Dependency resolution

## Error Handling

### Error Types
- `AgentTimeoutError`: Agent execution exceeded time limit
- `WorkflowError`: Workflow-level failures
- `DependencyError`: Required agent unavailable
- `ResourceError`: System resource constraints

### Recovery Strategies
1. Automatic retry with exponential backoff
2. Fallback to simpler agents
3. Partial result completion
4. Manual intervention requests

## Monitoring and Metrics

### Workflow Metrics
- Total workflows created
- Average completion time
- Success/failure rates
- Agent utilization
- Resource consumption

### Agent Performance
- Task completion rate
- Average response time
- Error frequency
- Quality scores
- Evolution metrics

## Database Schema

### Workflows Table
```sql
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    project_type VARCHAR(100),
    status VARCHAR(50),
    created_by UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    metadata JSONB
);
```

### Workflow Steps Table
```sql
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    phase VARCHAR(50),
    name VARCHAR(255),
    status VARCHAR(50),
    agents TEXT[],
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    inputs JSONB,
    outputs JSONB
);
```

## Best Practices

### Workflow Design
1. Keep workflows focused on single objectives
2. Use appropriate agent specializations
3. Define clear success criteria
4. Implement proper error handling
5. Monitor resource usage

### Agent Configuration
1. Set realistic timeouts
2. Configure appropriate retry policies
3. Define clear input/output contracts
4. Implement proper logging
5. Use circuit breakers for external dependencies

### Performance
1. Leverage parallel execution where possible
2. Cache intermediate results
3. Implement progressive enhancement
4. Monitor and optimize bottlenecks
5. Use resource pooling

## Future Enhancements

### Planned Features
- Visual workflow editor
- Custom workflow templates
- Agent marketplace
- Workflow versioning
- A/B testing for agent strategies
- Advanced scheduling capabilities
- Workflow composition and nesting

### Integration Points
- CI/CD pipeline integration
- External webhook triggers
- Third-party service connectors
- Custom agent plugins
- Workflow export/import

## Troubleshooting

### Common Issues

#### Workflow Stuck in Progress
- Check agent execution logs
- Verify timeout configurations
- Review circuit breaker status
- Check resource availability

#### Agent Communication Failures
- Verify gRPC service health
- Check network connectivity
- Review message queue status
- Validate agent registrations

#### Performance Degradation
- Monitor resource usage
- Check for memory leaks
- Review agent pool size
- Optimize parallel execution

## Related Documentation

- [Agent Specifications](../agent-specifications.md)
- [gRPC API Reference](../api/grpc-reference.md)
- [Architecture Overview](../architecture/overview.md)
- [Development Progress](../../DEVELOPMENT_PROGRESS.md)