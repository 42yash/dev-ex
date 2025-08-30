"""
Workflow Orchestrator for Dev-Ex Platform
Coordinates the entire agentic workflow from idea to deployment
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
import uuid

from .base import BaseAgent, AgentContext, AgentResult, AgentType
from .agent_pool_maker import AgentPoolMaker, ProjectRequirements
from .agent_darwin import AgentDarwin
from .communication import MessageBus, CollaborationCoordinator, MessageType, MessagePriority
from .lifecycle import LifecycleManager, AgentState, LifecycleState, DependencyType, AgentDependency
from ..config import Config
from ..db.connection import DatabaseManager
from ..cache.redis_client import RedisCache

logger = logging.getLogger(__name__)


class WorkflowPhase(Enum):
    """Workflow phases"""
    BRAINSTORMING = "brainstorming"
    REQUIREMENTS = "requirements"
    ARCHITECTURE = "architecture"
    DEVELOPMENT = "development"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"


class WorkflowStatus(Enum):
    """Workflow execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowStep:
    """A step in the workflow"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    phase: WorkflowPhase = WorkflowPhase.BRAINSTORMING
    name: str = ""
    description: str = ""
    agents: List[str] = field(default_factory=list)
    inputs: Dict[str, Any] = field(default_factory=dict)
    outputs: Dict[str, Any] = field(default_factory=dict)
    status: WorkflowStatus = WorkflowStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "phase": self.phase.value,
            "name": self.name,
            "description": self.description,
            "agents": self.agents,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error": self.error
        }


@dataclass
class WorkflowDefinition:
    """Complete workflow definition"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    project_type: str = ""
    steps: List[WorkflowStep] = field(default_factory=list)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)  # step_id -> [depends_on_ids]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "project_type": self.project_type,
            "steps": [step.to_dict() for step in self.steps],
            "dependencies": self.dependencies,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat()
        }


class WorkflowOrchestrator:
    """Orchestrates complex multi-agent workflows"""
    
    def __init__(
        self,
        config: Config,
        db_manager: DatabaseManager,
        cache: RedisCache,
        agent_pool_maker: AgentPoolMaker,
        agent_darwin: AgentDarwin
    ):
        self.config = config
        self.db_manager = db_manager
        self.cache = cache
        self.agent_pool_maker = agent_pool_maker
        self.agent_darwin = agent_darwin
        
        # Initialize components
        self.message_bus = MessageBus()
        self.lifecycle_manager = LifecycleManager(db_manager, cache, self.message_bus)
        self.collaboration_coordinator = CollaborationCoordinator(self.message_bus)
        
        # Workflow tracking
        self.active_workflows: Dict[str, WorkflowDefinition] = {}
        self.workflow_agents: Dict[str, Set[str]] = {}  # workflow_id -> agent_ids
        self.workflow_contexts: Dict[str, AgentContext] = {}
        
    async def initialize(self):
        """Initialize the orchestrator"""
        await self.message_bus.start()
        logger.info("Workflow Orchestrator initialized")
    
    async def create_workflow(
        self,
        user_input: str,
        session_id: str,
        user_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> WorkflowDefinition:
        """Create a workflow from user input"""
        logger.info(f"Creating workflow for session {session_id}")
        
        # Create context
        context = AgentContext(
            session_id=session_id,
            user_id=user_id,
            execution_id=str(uuid.uuid4()),
            variables=options or {}
        )
        
        # Phase 1: Analyze requirements using Agent Pool Maker
        requirements = await self.agent_pool_maker.analyze_requirements(user_input, context)
        
        # Create workflow definition
        workflow = WorkflowDefinition(
            name=f"Workflow for {requirements.project_type}",
            description=user_input,
            project_type=requirements.project_type
        )
        
        # Generate workflow steps based on requirements
        workflow.steps = self._generate_workflow_steps(requirements)
        
        # Store workflow
        self.active_workflows[workflow.id] = workflow
        self.workflow_contexts[workflow.id] = context
        
        # Save to database
        await self._save_workflow(workflow)
        
        logger.info(f"Created workflow {workflow.id} with {len(workflow.steps)} steps")
        return workflow
    
    def _generate_workflow_steps(self, requirements: ProjectRequirements) -> List[WorkflowStep]:
        """Generate workflow steps based on requirements"""
        steps = []
        
        # Brainstorming phase
        steps.append(WorkflowStep(
            phase=WorkflowPhase.BRAINSTORMING,
            name="Idea Refinement",
            description="Refine and validate the project idea",
            agents=["idea_generator", "architect"]
        ))
        
        # Requirements phase
        steps.append(WorkflowStep(
            phase=WorkflowPhase.REQUIREMENTS,
            name="Requirements Gathering",
            description="Gather and document detailed requirements",
            agents=["architect", "technical_writer"]
        ))
        
        # Architecture phase
        steps.append(WorkflowStep(
            phase=WorkflowPhase.ARCHITECTURE,
            name="System Design",
            description="Design system architecture and technical specifications",
            agents=["architect"]
        ))
        
        # Development phase - create steps based on technology stack
        if "backend" in str(requirements.technologies):
            steps.append(WorkflowStep(
                phase=WorkflowPhase.DEVELOPMENT,
                name="Backend Development",
                description="Implement backend services and APIs",
                agents=["python_backend", "database_engineer"]
            ))
        
        if "frontend" in str(requirements.technologies):
            steps.append(WorkflowStep(
                phase=WorkflowPhase.DEVELOPMENT,
                name="Frontend Development",
                description="Implement user interface and client-side logic",
                agents=["frontend_vue", "frontend_react"]
            ))
        
        # Testing phase
        steps.append(WorkflowStep(
            phase=WorkflowPhase.TESTING,
            name="Quality Assurance",
            description="Test and validate the implementation",
            agents=["qa_engineer"]
        ))
        
        # Deployment phase
        if requirements.complexity in ["medium", "high"]:
            steps.append(WorkflowStep(
                phase=WorkflowPhase.DEPLOYMENT,
                name="Deployment Setup",
                description="Configure deployment and CI/CD",
                agents=["devops_engineer"]
            ))
        
        return steps
    
    async def execute_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Execute a complete workflow"""
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        workflow = self.active_workflows[workflow_id]
        context = self.workflow_contexts[workflow_id]
        
        logger.info(f"Starting execution of workflow {workflow_id}")
        
        try:
            # Create agent pool based on workflow requirements
            agent_pool_result = await self.agent_pool_maker.create_agent_pool(
                workflow.description,
                context
            )
            
            # Track created agents
            created_agent_ids = []
            for agent_spec in agent_pool_result["agents"]:
                agent_id = agent_spec["agent_id"]
                created_agent_ids.append(agent_id)
                
                # Create mock agent for testing
                # In production, this would create actual agent instances
                agent_state = AgentState(
                    agent_id=agent_id,
                    name=agent_spec["name"],
                    type=AgentType.CODE,
                    lifecycle_state=LifecycleState.READY,
                    status=AgentStatus.IDLE,
                    created_at=datetime.utcnow(),
                    last_updated=datetime.utcnow()
                )
                self.lifecycle_manager.agent_states[agent_id] = agent_state
            
            self.workflow_agents[workflow_id] = set(created_agent_ids)
            
            # Execute workflow steps
            results = []
            for step in workflow.steps:
                result = await self._execute_step(workflow_id, step)
                results.append(result)
                
                # Monitor and evolve agents after each step
                await self._monitor_and_evolve(step.agents)
            
            # Generate final output
            output = {
                "workflow_id": workflow_id,
                "status": "completed",
                "steps_completed": len(results),
                "agent_pool": agent_pool_result,
                "results": results,
                "metadata": {
                    "total_agents": len(created_agent_ids),
                    "execution_time": "simulated",
                    "optimization_applied": True
                }
            }
            
            logger.info(f"Workflow {workflow_id} completed successfully")
            return output
            
        except Exception as e:
            logger.error(f"Workflow {workflow_id} failed: {e}")
            return {
                "workflow_id": workflow_id,
                "status": "failed",
                "error": str(e)
            }
    
    async def _execute_step(self, workflow_id: str, step: WorkflowStep) -> Dict[str, Any]:
        """Execute a single workflow step"""
        logger.info(f"Executing step {step.name} for workflow {workflow_id}")
        
        step.status = WorkflowStatus.IN_PROGRESS
        step.started_at = datetime.utcnow()
        
        try:
            # Get agents for this step
            agent_ids = []
            for agent_name in step.agents:
                # Find agent by name in workflow agents
                for agent_id in self.workflow_agents[workflow_id]:
                    if agent_name in agent_id:
                        agent_ids.append(agent_id)
                        break
            
            if not agent_ids:
                # Use default agents if specific ones not found
                agent_ids = list(self.workflow_agents[workflow_id])[:2]
            
            # Create collaboration for this step
            collaboration_id = f"{workflow_id}_{step.id}"
            await self.collaboration_coordinator.initiate_collaboration(
                collaboration_id=collaboration_id,
                participants=agent_ids,
                objective=step.description,
                context={"step": step.to_dict()}
            )
            
            # Simulate step execution
            await asyncio.sleep(0.1)  # Simulate work
            
            # Generate output based on phase
            output = self._generate_step_output(step.phase)
            step.outputs = output
            
            # End collaboration
            await self.collaboration_coordinator.end_collaboration(
                collaboration_id=collaboration_id,
                result=output
            )
            
            step.status = WorkflowStatus.COMPLETED
            step.completed_at = datetime.utcnow()
            
            return {
                "step_id": step.id,
                "name": step.name,
                "phase": step.phase.value,
                "status": "completed",
                "output": output
            }
            
        except Exception as e:
            step.status = WorkflowStatus.FAILED
            step.error = str(e)
            logger.error(f"Step {step.name} failed: {e}")
            raise
    
    def _generate_step_output(self, phase: WorkflowPhase) -> Dict[str, Any]:
        """Generate mock output for a workflow phase"""
        outputs = {
            WorkflowPhase.BRAINSTORMING: {
                "refined_idea": "E-commerce platform with AI-powered recommendations",
                "key_features": ["User auth", "Product catalog", "AI recommendations"],
                "target_audience": "Small to medium businesses"
            },
            WorkflowPhase.REQUIREMENTS: {
                "functional_requirements": ["User management", "Product CRUD", "Order processing"],
                "non_functional_requirements": ["99.9% uptime", "sub-second response time"],
                "user_stories": ["As a user, I want to browse products", "As an admin, I want to manage inventory"]
            },
            WorkflowPhase.ARCHITECTURE: {
                "architecture_type": "Microservices",
                "components": ["API Gateway", "Auth Service", "Product Service", "Order Service"],
                "database": "PostgreSQL with Redis cache",
                "deployment": "Kubernetes on AWS"
            },
            WorkflowPhase.DEVELOPMENT: {
                "code_files": ["app.py", "models.py", "api.py", "frontend/App.vue"],
                "lines_of_code": 5000,
                "test_coverage": 0.85
            },
            WorkflowPhase.TESTING: {
                "tests_run": 150,
                "tests_passed": 145,
                "coverage": 0.85,
                "issues_found": 5,
                "issues_fixed": 5
            },
            WorkflowPhase.DEPLOYMENT: {
                "deployment_url": "https://app.example.com",
                "ci_cd_pipeline": "GitHub Actions",
                "monitoring": "Prometheus + Grafana",
                "rollback_strategy": "Blue-green deployment"
            },
            WorkflowPhase.MONITORING: {
                "uptime": "99.95%",
                "response_time": "250ms avg",
                "error_rate": "0.1%",
                "active_users": 1000
            }
        }
        
        return outputs.get(phase, {"status": "completed"})
    
    async def _monitor_and_evolve(self, agent_names: List[str]):
        """Monitor agent performance and trigger evolution if needed"""
        for agent_name in agent_names:
            # Find agent ID
            agent_id = None
            for wf_id, agents in self.workflow_agents.items():
                for aid in agents:
                    if agent_name in aid:
                        agent_id = aid
                        break
                if agent_id:
                    break
            
            if agent_id:
                # Monitor performance (mock data for testing)
                execution_result = {
                    "status": "success",
                    "execution_time": 15.0,
                    "error": None
                }
                
                metrics = await self.agent_darwin.monitor_agent_performance(
                    agent_id,
                    execution_result
                )
                
                # Check if evolution is needed
                if metrics.calculate_overall_score() < 0.7:
                    logger.info(f"Agent {agent_id} performance below threshold, triggering evolution")
                    # Evolution would happen here in production
    
    async def pause_workflow(self, workflow_id: str):
        """Pause workflow execution"""
        if workflow_id in self.active_workflows:
            # Pause all agents in workflow
            for agent_id in self.workflow_agents.get(workflow_id, []):
                if agent_id in self.lifecycle_manager.agent_states:
                    await self.lifecycle_manager.pause_agent(agent_id)
            
            logger.info(f"Paused workflow {workflow_id}")
    
    async def resume_workflow(self, workflow_id: str):
        """Resume workflow execution"""
        if workflow_id in self.active_workflows:
            # Resume all agents in workflow
            for agent_id in self.workflow_agents.get(workflow_id, []):
                if agent_id in self.lifecycle_manager.agent_states:
                    await self.lifecycle_manager.resume_agent(agent_id)
            
            logger.info(f"Resumed workflow {workflow_id}")
    
    async def cancel_workflow(self, workflow_id: str):
        """Cancel workflow execution"""
        if workflow_id in self.active_workflows:
            # Terminate all agents in workflow
            for agent_id in self.workflow_agents.get(workflow_id, []):
                if agent_id in self.lifecycle_manager.agent_states:
                    await self.lifecycle_manager.terminate_agent(agent_id, force=True)
            
            # Clean up workflow data
            if workflow_id in self.active_workflows:
                del self.active_workflows[workflow_id]
            if workflow_id in self.workflow_agents:
                del self.workflow_agents[workflow_id]
            if workflow_id in self.workflow_contexts:
                del self.workflow_contexts[workflow_id]
            
            logger.info(f"Cancelled workflow {workflow_id}")
    
    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get current status of a workflow"""
        if workflow_id not in self.active_workflows:
            return {"error": "Workflow not found"}
        
        workflow = self.active_workflows[workflow_id]
        
        # Calculate progress
        total_steps = len(workflow.steps)
        completed_steps = sum(1 for s in workflow.steps if s.status == WorkflowStatus.COMPLETED)
        
        # Get agent statuses
        agent_statuses = {}
        for agent_id in self.workflow_agents.get(workflow_id, []):
            if agent_id in self.lifecycle_manager.agent_states:
                state = self.lifecycle_manager.agent_states[agent_id]
                agent_statuses[agent_id] = {
                    "name": state.name,
                    "state": state.lifecycle_state.value,
                    "status": state.status.value
                }
        
        return {
            "workflow_id": workflow_id,
            "name": workflow.name,
            "progress": f"{completed_steps}/{total_steps}",
            "percentage": (completed_steps / total_steps * 100) if total_steps > 0 else 0,
            "current_phase": next((s.phase.value for s in workflow.steps if s.status == WorkflowStatus.IN_PROGRESS), None),
            "agents": agent_statuses,
            "steps": [s.to_dict() for s in workflow.steps]
        }
    
    async def _save_workflow(self, workflow: WorkflowDefinition):
        """Save workflow to database"""
        try:
            query = """
                INSERT INTO workflows 
                (id, name, description, project_type, definition, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            """
            
            await self.db_manager.execute(
                query,
                workflow.id,
                workflow.name,
                workflow.description,
                workflow.project_type,
                json.dumps(workflow.to_dict()),
                workflow.created_at
            )
            
        except Exception as e:
            logger.error(f"Failed to save workflow: {e}")
    
    async def shutdown(self):
        """Shutdown the orchestrator"""
        # Cancel all active workflows
        for workflow_id in list(self.active_workflows.keys()):
            await self.cancel_workflow(workflow_id)
        
        # Stop message bus
        await self.message_bus.stop()
        
        logger.info("Workflow Orchestrator shutdown complete")