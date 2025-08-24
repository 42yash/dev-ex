"""
Agent Lifecycle Management System
Handles agent creation, state persistence, dependency resolution, and orchestration
"""

import asyncio
import json
import logging
import pickle
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
import uuid
from pathlib import Path

from .base import BaseAgent, AgentContext, AgentResult, AgentType, AgentStatus
from .communication import MessageBus, AgentProtocol, MessageType, MessagePriority
from ..db.connection import DatabaseManager
from ..cache.redis_client import RedisCache

logger = logging.getLogger(__name__)


class LifecycleState(Enum):
    """Agent lifecycle states"""
    CREATED = "created"
    INITIALIZING = "initializing"
    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    SUSPENDED = "suspended"
    TERMINATING = "terminating"
    TERMINATED = "terminated"
    ERROR = "error"


class DependencyType(Enum):
    """Types of agent dependencies"""
    REQUIRES = "requires"          # Must exist before this agent
    OPTIONAL = "optional"          # Nice to have but not required
    CONFLICTS = "conflicts"        # Cannot coexist
    REPLACES = "replaces"         # This agent replaces another
    COMPLEMENTS = "complements"    # Works well together


@dataclass
class AgentDependency:
    """Represents a dependency between agents"""
    agent_id: str
    depends_on: str
    dependency_type: DependencyType
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentState:
    """Complete state of an agent"""
    agent_id: str
    name: str
    type: AgentType
    lifecycle_state: LifecycleState
    status: AgentStatus
    created_at: datetime
    last_updated: datetime
    execution_count: int = 0
    error_count: int = 0
    context: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    checkpoints: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "type": self.type.value,
            "lifecycle_state": self.lifecycle_state.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "execution_count": self.execution_count,
            "error_count": self.error_count,
            "context": self.context,
            "metadata": self.metadata,
            "checkpoints": self.checkpoints
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentState":
        """Create from dictionary"""
        return cls(
            agent_id=data["agent_id"],
            name=data["name"],
            type=AgentType(data["type"]),
            lifecycle_state=LifecycleState(data["lifecycle_state"]),
            status=AgentStatus(data["status"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            last_updated=datetime.fromisoformat(data["last_updated"]),
            execution_count=data.get("execution_count", 0),
            error_count=data.get("error_count", 0),
            context=data.get("context", {}),
            metadata=data.get("metadata", {}),
            checkpoints=data.get("checkpoints", [])
        )


class DependencyResolver:
    """Resolves dependencies between agents"""
    
    def __init__(self):
        self.dependencies: List[AgentDependency] = []
        self.dependency_graph: Dict[str, Set[str]] = {}
        self.reverse_graph: Dict[str, Set[str]] = {}
        
    def add_dependency(self, dependency: AgentDependency):
        """Add a dependency"""
        self.dependencies.append(dependency)
        
        # Update graphs for REQUIRES dependencies
        if dependency.dependency_type == DependencyType.REQUIRES:
            if dependency.agent_id not in self.dependency_graph:
                self.dependency_graph[dependency.agent_id] = set()
            self.dependency_graph[dependency.agent_id].add(dependency.depends_on)
            
            if dependency.depends_on not in self.reverse_graph:
                self.reverse_graph[dependency.depends_on] = set()
            self.reverse_graph[dependency.depends_on].add(dependency.agent_id)
    
    def resolve_order(self, agent_ids: List[str]) -> List[str]:
        """Resolve execution order based on dependencies"""
        # Topological sort
        visited = set()
        order = []
        
        def visit(agent_id: str):
            if agent_id in visited:
                return
            visited.add(agent_id)
            
            # Visit dependencies first
            if agent_id in self.dependency_graph:
                for dep in self.dependency_graph[agent_id]:
                    if dep in agent_ids:  # Only consider agents in our list
                        visit(dep)
            
            order.append(agent_id)
        
        for agent_id in agent_ids:
            visit(agent_id)
        
        return order
    
    def check_conflicts(self, agent_ids: List[str]) -> List[Tuple[str, str]]:
        """Check for conflicts between agents"""
        conflicts = []
        
        for dep in self.dependencies:
            if dep.dependency_type == DependencyType.CONFLICTS:
                if dep.agent_id in agent_ids and dep.depends_on in agent_ids:
                    conflicts.append((dep.agent_id, dep.depends_on))
        
        return conflicts
    
    def get_required_agents(self, agent_id: str) -> Set[str]:
        """Get all required agents for a given agent"""
        required = set()
        to_visit = [agent_id]
        visited = set()
        
        while to_visit:
            current = to_visit.pop()
            if current in visited:
                continue
            visited.add(current)
            
            if current in self.dependency_graph:
                for dep in self.dependency_graph[current]:
                    required.add(dep)
                    to_visit.append(dep)
        
        return required
    
    def can_terminate(self, agent_id: str, active_agents: Set[str]) -> bool:
        """Check if an agent can be safely terminated"""
        # Check if any active agents depend on this one
        if agent_id in self.reverse_graph:
            dependents = self.reverse_graph[agent_id] & active_agents
            if dependents:
                logger.warning(f"Cannot terminate {agent_id}: required by {dependents}")
                return False
        return True


class StatePersistence:
    """Handles agent state persistence"""
    
    def __init__(self, db_manager: DatabaseManager, cache: RedisCache):
        self.db_manager = db_manager
        self.cache = cache
        self.state_dir = Path("/tmp/agent_states")
        self.state_dir.mkdir(exist_ok=True)
        
    async def save_state(self, agent_state: AgentState):
        """Save agent state to persistent storage"""
        try:
            # Save to cache for quick access
            cache_key = f"agent_state:{agent_state.agent_id}"
            await self.cache.set(
                cache_key,
                json.dumps(agent_state.to_dict()),
                ttl=3600  # 1 hour TTL
            )
            
            # Save to database for long-term storage
            query = """
                INSERT INTO agent_states 
                (agent_id, name, type, lifecycle_state, status, context, metadata, 
                 execution_count, error_count, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (agent_id) DO UPDATE SET
                    lifecycle_state = EXCLUDED.lifecycle_state,
                    status = EXCLUDED.status,
                    context = EXCLUDED.context,
                    metadata = EXCLUDED.metadata,
                    execution_count = EXCLUDED.execution_count,
                    error_count = EXCLUDED.error_count,
                    updated_at = EXCLUDED.updated_at
            """
            
            await self.db_manager.execute(
                query,
                agent_state.agent_id,
                agent_state.name,
                agent_state.type.value,
                agent_state.lifecycle_state.value,
                agent_state.status.value,
                json.dumps(agent_state.context),
                json.dumps(agent_state.metadata),
                agent_state.execution_count,
                agent_state.error_count,
                agent_state.created_at,
                agent_state.last_updated
            )
            
            # Save checkpoint to file for recovery
            checkpoint_file = self.state_dir / f"{agent_state.agent_id}.checkpoint"
            with open(checkpoint_file, 'wb') as f:
                pickle.dump(agent_state, f)
                
            logger.info(f"Saved state for agent {agent_state.agent_id}")
            
        except Exception as e:
            logger.error(f"Failed to save agent state: {e}")
            raise
    
    async def load_state(self, agent_id: str) -> Optional[AgentState]:
        """Load agent state from storage"""
        try:
            # Try cache first
            cache_key = f"agent_state:{agent_id}"
            cached = await self.cache.get(cache_key)
            if cached:
                return AgentState.from_dict(json.loads(cached))
            
            # Try database
            query = """
                SELECT agent_id, name, type, lifecycle_state, status, 
                       context, metadata, execution_count, error_count,
                       created_at, updated_at
                FROM agent_states
                WHERE agent_id = $1
            """
            
            result = await self.db_manager.query_one(query, agent_id)
            if result:
                return AgentState(
                    agent_id=result['agent_id'],
                    name=result['name'],
                    type=AgentType(result['type']),
                    lifecycle_state=LifecycleState(result['lifecycle_state']),
                    status=AgentStatus(result['status']),
                    created_at=result['created_at'],
                    last_updated=result['updated_at'],
                    execution_count=result['execution_count'],
                    error_count=result['error_count'],
                    context=json.loads(result['context']),
                    metadata=json.loads(result['metadata'])
                )
            
            # Try checkpoint file
            checkpoint_file = self.state_dir / f"{agent_id}.checkpoint"
            if checkpoint_file.exists():
                with open(checkpoint_file, 'rb') as f:
                    return pickle.load(f)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to load agent state: {e}")
            return None
    
    async def create_checkpoint(self, agent_state: AgentState, checkpoint_data: Dict[str, Any]):
        """Create a checkpoint for an agent"""
        checkpoint = {
            "timestamp": datetime.utcnow().isoformat(),
            "data": checkpoint_data,
            "execution_count": agent_state.execution_count
        }
        
        agent_state.checkpoints.append(checkpoint)
        
        # Keep only last 10 checkpoints
        if len(agent_state.checkpoints) > 10:
            agent_state.checkpoints = agent_state.checkpoints[-10:]
        
        await self.save_state(agent_state)
        logger.info(f"Created checkpoint for agent {agent_state.agent_id}")
    
    async def restore_checkpoint(self, agent_id: str, checkpoint_index: int = -1) -> Optional[Dict[str, Any]]:
        """Restore agent from a checkpoint"""
        agent_state = await self.load_state(agent_id)
        if not agent_state or not agent_state.checkpoints:
            return None
        
        try:
            checkpoint = agent_state.checkpoints[checkpoint_index]
            logger.info(f"Restored checkpoint for agent {agent_id} from {checkpoint['timestamp']}")
            return checkpoint['data']
        except IndexError:
            logger.error(f"Checkpoint index {checkpoint_index} not found for agent {agent_id}")
            return None


class LifecycleManager:
    """Manages the complete lifecycle of agents"""
    
    def __init__(self, db_manager: DatabaseManager, cache: RedisCache, message_bus: MessageBus):
        self.db_manager = db_manager
        self.cache = cache
        self.message_bus = message_bus
        self.persistence = StatePersistence(db_manager, cache)
        self.dependency_resolver = DependencyResolver()
        self.agent_states: Dict[str, AgentState] = {}
        self.agent_protocols: Dict[str, AgentProtocol] = {}
        self.lifecycle_hooks: Dict[LifecycleState, List[callable]] = {
            state: [] for state in LifecycleState
        }
        
    async def create_agent(self, agent: BaseAgent, dependencies: Optional[List[AgentDependency]] = None) -> AgentState:
        """Create and initialize a new agent"""
        agent_id = f"{agent.name}_{uuid.uuid4().hex[:8]}"
        
        # Create agent state
        agent_state = AgentState(
            agent_id=agent_id,
            name=agent.name,
            type=agent.agent_type,
            lifecycle_state=LifecycleState.CREATED,
            status=AgentStatus.IDLE,
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )
        
        self.agent_states[agent_id] = agent_state
        
        # Add dependencies
        if dependencies:
            for dep in dependencies:
                dep.agent_id = agent_id
                self.dependency_resolver.add_dependency(dep)
        
        # Create communication protocol
        protocol = AgentProtocol(agent_id, self.message_bus)
        self.agent_protocols[agent_id] = protocol
        
        # Transition to initializing
        await self.transition_state(agent_id, LifecycleState.INITIALIZING)
        
        # Initialize agent
        try:
            # Perform initialization tasks
            await self._initialize_agent(agent, agent_state)
            
            # Transition to ready
            await self.transition_state(agent_id, LifecycleState.READY)
            
            # Save state
            await self.persistence.save_state(agent_state)
            
            logger.info(f"Created agent {agent_id} ({agent.name})")
            return agent_state
            
        except Exception as e:
            logger.error(f"Failed to create agent {agent_id}: {e}")
            await self.transition_state(agent_id, LifecycleState.ERROR)
            raise
    
    async def _initialize_agent(self, agent: BaseAgent, agent_state: AgentState):
        """Initialize an agent"""
        # Check dependencies
        required = self.dependency_resolver.get_required_agents(agent_state.agent_id)
        for req_id in required:
            if req_id not in self.agent_states or \
               self.agent_states[req_id].lifecycle_state not in [LifecycleState.READY, LifecycleState.RUNNING]:
                raise ValueError(f"Required agent {req_id} is not ready")
        
        # Register message handlers
        protocol = self.agent_protocols[agent_state.agent_id]
        
        async def handle_execute(message):
            """Handle execution requests"""
            result = await agent.execute(
                message.payload.get("input"),
                AgentContext(
                    session_id=message.context.get("session_id", ""),
                    user_id=message.context.get("user_id", ""),
                    execution_id=message.context.get("execution_id", "")
                )
            )
            return result.__dict__
        
        protocol.register_handler(MessageType.REQUEST, handle_execute)
    
    async def transition_state(self, agent_id: str, new_state: LifecycleState):
        """Transition an agent to a new lifecycle state"""
        if agent_id not in self.agent_states:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent_state = self.agent_states[agent_id]
        old_state = agent_state.lifecycle_state
        
        # Validate transition
        if not self._is_valid_transition(old_state, new_state):
            raise ValueError(f"Invalid transition from {old_state} to {new_state}")
        
        # Update state
        agent_state.lifecycle_state = new_state
        agent_state.last_updated = datetime.utcnow()
        
        # Run lifecycle hooks
        for hook in self.lifecycle_hooks[new_state]:
            await hook(agent_state)
        
        # Notify other agents
        protocol = self.agent_protocols[agent_id]
        await protocol.broadcast(
            MessageType.EVENT,
            {
                "event": "lifecycle_transition",
                "agent_id": agent_id,
                "old_state": old_state.value,
                "new_state": new_state.value
            }
        )
        
        # Save state
        await self.persistence.save_state(agent_state)
        
        logger.info(f"Agent {agent_id} transitioned from {old_state.value} to {new_state.value}")
    
    def _is_valid_transition(self, from_state: LifecycleState, to_state: LifecycleState) -> bool:
        """Check if a state transition is valid"""
        valid_transitions = {
            LifecycleState.CREATED: [LifecycleState.INITIALIZING, LifecycleState.ERROR],
            LifecycleState.INITIALIZING: [LifecycleState.READY, LifecycleState.ERROR],
            LifecycleState.READY: [LifecycleState.RUNNING, LifecycleState.PAUSED, LifecycleState.TERMINATING],
            LifecycleState.RUNNING: [LifecycleState.READY, LifecycleState.PAUSED, LifecycleState.SUSPENDED, LifecycleState.TERMINATING, LifecycleState.ERROR],
            LifecycleState.PAUSED: [LifecycleState.RUNNING, LifecycleState.READY, LifecycleState.TERMINATING],
            LifecycleState.SUSPENDED: [LifecycleState.READY, LifecycleState.TERMINATING],
            LifecycleState.TERMINATING: [LifecycleState.TERMINATED],
            LifecycleState.ERROR: [LifecycleState.READY, LifecycleState.TERMINATING],
            LifecycleState.TERMINATED: []
        }
        
        return to_state in valid_transitions.get(from_state, [])
    
    async def start_agent(self, agent_id: str):
        """Start an agent"""
        await self.transition_state(agent_id, LifecycleState.RUNNING)
        
        # Update status
        if agent_id in self.agent_states:
            self.agent_states[agent_id].status = AgentStatus.RUNNING
            await self.persistence.save_state(self.agent_states[agent_id])
    
    async def pause_agent(self, agent_id: str):
        """Pause an agent"""
        await self.transition_state(agent_id, LifecycleState.PAUSED)
        
        # Update status
        if agent_id in self.agent_states:
            self.agent_states[agent_id].status = AgentStatus.IDLE
            await self.persistence.save_state(self.agent_states[agent_id])
    
    async def resume_agent(self, agent_id: str):
        """Resume a paused agent"""
        if agent_id in self.agent_states:
            if self.agent_states[agent_id].lifecycle_state == LifecycleState.PAUSED:
                await self.transition_state(agent_id, LifecycleState.RUNNING)
                self.agent_states[agent_id].status = AgentStatus.RUNNING
                await self.persistence.save_state(self.agent_states[agent_id])
    
    async def terminate_agent(self, agent_id: str, force: bool = False):
        """Terminate an agent"""
        if not force:
            # Check dependencies
            active_agents = {
                aid for aid, state in self.agent_states.items()
                if state.lifecycle_state in [LifecycleState.READY, LifecycleState.RUNNING]
            }
            if not self.dependency_resolver.can_terminate(agent_id, active_agents):
                raise ValueError(f"Cannot terminate {agent_id}: other agents depend on it")
        
        # Transition to terminating
        await self.transition_state(agent_id, LifecycleState.TERMINATING)
        
        # Clean up resources
        if agent_id in self.agent_protocols:
            self.message_bus.unregister_agent(agent_id)
            del self.agent_protocols[agent_id]
        
        # Transition to terminated
        await self.transition_state(agent_id, LifecycleState.TERMINATED)
        
        # Update status
        if agent_id in self.agent_states:
            self.agent_states[agent_id].status = AgentStatus.COMPLETED
            await self.persistence.save_state(self.agent_states[agent_id])
            
            # Remove from active states after saving
            del self.agent_states[agent_id]
    
    async def suspend_agent(self, agent_id: str, reason: str = ""):
        """Suspend an agent (e.g., due to errors)"""
        await self.transition_state(agent_id, LifecycleState.SUSPENDED)
        
        if agent_id in self.agent_states:
            self.agent_states[agent_id].status = AgentStatus.FAILED
            self.agent_states[agent_id].metadata["suspension_reason"] = reason
            await self.persistence.save_state(self.agent_states[agent_id])
    
    async def recover_agent(self, agent_id: str) -> bool:
        """Recover an agent from error or suspended state"""
        state = await self.persistence.load_state(agent_id)
        if not state:
            logger.error(f"Cannot recover agent {agent_id}: state not found")
            return False
        
        # Restore state
        self.agent_states[agent_id] = state
        
        # Recreate protocol
        protocol = AgentProtocol(agent_id, self.message_bus)
        self.agent_protocols[agent_id] = protocol
        
        # Transition to ready
        await self.transition_state(agent_id, LifecycleState.READY)
        
        logger.info(f"Recovered agent {agent_id}")
        return True
    
    def register_lifecycle_hook(self, state: LifecycleState, hook: callable):
        """Register a hook to be called on state transitions"""
        self.lifecycle_hooks[state].append(hook)
    
    def get_agent_state(self, agent_id: str) -> Optional[AgentState]:
        """Get current state of an agent"""
        return self.agent_states.get(agent_id)
    
    def get_all_agents(self, state_filter: Optional[LifecycleState] = None) -> List[AgentState]:
        """Get all agents, optionally filtered by state"""
        agents = list(self.agent_states.values())
        if state_filter:
            agents = [a for a in agents if a.lifecycle_state == state_filter]
        return agents
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on all agents"""
        health = {
            "total_agents": len(self.agent_states),
            "agents_by_state": {},
            "agents_by_status": {},
            "unhealthy_agents": []
        }
        
        for state in LifecycleState:
            count = sum(1 for a in self.agent_states.values() if a.lifecycle_state == state)
            if count > 0:
                health["agents_by_state"][state.value] = count
        
        for status in AgentStatus:
            count = sum(1 for a in self.agent_states.values() if a.status == status)
            if count > 0:
                health["agents_by_status"][status.value] = count
        
        # Check for unhealthy agents
        for agent_id, state in self.agent_states.items():
            if state.lifecycle_state in [LifecycleState.ERROR, LifecycleState.SUSPENDED]:
                health["unhealthy_agents"].append({
                    "agent_id": agent_id,
                    "name": state.name,
                    "state": state.lifecycle_state.value,
                    "error_count": state.error_count
                })
        
        return health