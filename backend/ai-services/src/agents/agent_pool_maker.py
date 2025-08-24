"""
Agent Pool Maker (Agent 0) - Master Orchestrator
Creates and manages specialized agents based on project requirements
"""

import json
import logging
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
import asyncio
from datetime import datetime
import uuid

from .base import BaseAgent, AgentContext, AgentStatus, AgentType
from .execution_limiter import ExecutionLimiter
from ..config import Config

logger = logging.getLogger(__name__)


class TechnologyStack(Enum):
    """Supported technology stacks"""
    PYTHON_FASTAPI = "python_fastapi"
    PYTHON_DJANGO = "python_django"
    PYTHON_FLASK = "python_flask"
    NODEJS_EXPRESS = "nodejs_express"
    NODEJS_NESTJS = "nodejs_nestjs"
    VUE_TYPESCRIPT = "vue_typescript"
    REACT_TYPESCRIPT = "react_typescript"
    ANGULAR = "angular"
    GOLANG = "golang"
    RUST = "rust"
    DATABASE_POSTGRES = "database_postgres"
    DATABASE_MONGODB = "database_mongodb"
    DATABASE_REDIS = "database_redis"
    DOCKER = "docker"
    KUBERNETES = "kubernetes"
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"


@dataclass
class AgentSpecification:
    """Specification for creating an agent"""
    agent_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    type: AgentType = AgentType.CODE
    technologies: List[TechnologyStack] = field(default_factory=list)
    responsibilities: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)  # IDs of other agents
    tools: List[str] = field(default_factory=list)
    context_requirements: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "type": self.type.value,
            "technologies": [t.value for t in self.technologies],
            "responsibilities": self.responsibilities,
            "dependencies": self.dependencies,
            "tools": self.tools,
            "context_requirements": self.context_requirements,
            "performance_metrics": self.performance_metrics,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class ProjectRequirements:
    """Analyzed project requirements"""
    project_type: str = ""  # web_app, api, cli, mobile, etc.
    technologies: Set[TechnologyStack] = field(default_factory=set)
    features: List[str] = field(default_factory=list)
    complexity: str = "medium"  # simple, medium, complex
    timeline: str = "standard"  # urgent, standard, relaxed
    team_size: int = 1
    has_authentication: bool = False
    has_database: bool = False
    has_realtime: bool = False
    has_deployment: bool = False
    has_testing: bool = True
    has_documentation: bool = True


class AgentPoolMaker(BaseAgent):
    """
    Agent 0 - Master orchestrator that creates and manages other agents
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None):
        super().__init__(
            name="agent_pool_maker",
            agent_type=AgentType.META,
            system_prompt="""You are Agent 0, the master orchestrator of the Dev-Ex AI ecosystem.
            Your role is to analyze project requirements and dynamically create specialized agents
            to accomplish complex tasks. You understand various project types, technology stacks,
            and can determine the optimal team of agents needed for any given project.""",
            model=None,  # We'll use specialized logic instead of direct model calls
            config={}
        )
        self.agent_id = "agent-0"  # Store separately
        self.config = config
        self.execution_limiter = execution_limiter
        
        self.agent_pool: Dict[str, AgentSpecification] = {}
        self.agent_templates = self._initialize_templates()
        self.technology_mapping = self._initialize_technology_mapping()
        
    def _initialize_templates(self) -> Dict[str, AgentSpecification]:
        """Initialize agent templates for common scenarios"""
        return {
            "python_backend": AgentSpecification(
                name="Python Backend Developer",
                type=AgentType.CODE,
                technologies=[TechnologyStack.PYTHON_FASTAPI],
                responsibilities=[
                    "Create API endpoints",
                    "Implement business logic",
                    "Handle database operations",
                    "Implement authentication",
                    "Write unit tests"
                ],
                tools=["python_mcp", "fastapi_docs", "sqlalchemy_docs"]
            ),
            "frontend_vue": AgentSpecification(
                name="Vue Frontend Developer",
                type=AgentType.CODE,
                technologies=[TechnologyStack.VUE_TYPESCRIPT],
                responsibilities=[
                    "Create Vue components",
                    "Implement routing",
                    "Handle state management",
                    "Integrate with APIs",
                    "Implement responsive design"
                ],
                tools=["vue_mcp", "typescript_docs", "pinia_docs"]
            ),
            "frontend_react": AgentSpecification(
                name="React Frontend Developer",
                type=AgentType.CODE,
                technologies=[TechnologyStack.REACT_TYPESCRIPT],
                responsibilities=[
                    "Create React components",
                    "Implement routing",
                    "Handle state management",
                    "Integrate with APIs",
                    "Implement responsive design"
                ],
                tools=["react_mcp", "typescript_docs", "redux_docs"]
            ),
            "database_engineer": AgentSpecification(
                name="Database Engineer",
                type=AgentType.CODE,
                technologies=[TechnologyStack.DATABASE_POSTGRES],
                responsibilities=[
                    "Design database schema",
                    "Create migrations",
                    "Optimize queries",
                    "Implement indexes",
                    "Setup replication"
                ],
                tools=["postgres_docs", "sql_analyzer"]
            ),
            "devops_engineer": AgentSpecification(
                name="DevOps Engineer",
                type=AgentType.CODE,
                technologies=[TechnologyStack.DOCKER, TechnologyStack.KUBERNETES],
                responsibilities=[
                    "Create Docker containers",
                    "Setup CI/CD pipelines",
                    "Configure Kubernetes",
                    "Implement monitoring",
                    "Handle deployments"
                ],
                tools=["docker_docs", "k8s_docs", "github_actions"]
            ),
            "technical_writer": AgentSpecification(
                name="Technical Documentation Writer",
                type=AgentType.DOCUMENTATION,
                technologies=[],
                responsibilities=[
                    "Write API documentation",
                    "Create user guides",
                    "Document architecture",
                    "Write README files",
                    "Create tutorials"
                ],
                tools=["markdown_editor", "diagram_tool"]
            ),
            "qa_engineer": AgentSpecification(
                name="QA Engineer",
                type=AgentType.ANALYSIS,
                technologies=[],
                responsibilities=[
                    "Write test cases",
                    "Perform integration testing",
                    "Create E2E tests",
                    "Report bugs",
                    "Verify fixes"
                ],
                tools=["jest", "cypress", "pytest"]
            )
        }
    
    def _initialize_technology_mapping(self) -> Dict[TechnologyStack, List[str]]:
        """Map technologies to required agent templates"""
        return {
            TechnologyStack.PYTHON_FASTAPI: ["python_backend"],
            TechnologyStack.PYTHON_DJANGO: ["python_backend"],
            TechnologyStack.PYTHON_FLASK: ["python_backend"],
            TechnologyStack.VUE_TYPESCRIPT: ["frontend_vue"],
            TechnologyStack.REACT_TYPESCRIPT: ["frontend_react"],
            TechnologyStack.DATABASE_POSTGRES: ["database_engineer"],
            TechnologyStack.DATABASE_MONGODB: ["database_engineer"],
            TechnologyStack.DOCKER: ["devops_engineer"],
            TechnologyStack.KUBERNETES: ["devops_engineer"],
        }
    
    async def analyze_requirements(self, user_input: str, context: AgentContext) -> ProjectRequirements:
        """Analyze user input to determine project requirements"""
        logger.info(f"Analyzing requirements from user input: {user_input[:100]}...")
        
        prompt = f"""
        Analyze the following project requirements and extract key information:
        
        User Input: {user_input}
        
        Determine:
        1. Project type (web_app, api, cli, mobile, etc.)
        2. Required technologies (frontend, backend, database)
        3. Key features needed
        4. Complexity level (simple, medium, complex)
        5. Special requirements (auth, realtime, etc.)
        
        Respond in JSON format with these fields:
        - project_type: string
        - frontend_tech: string (vue, react, angular, none)
        - backend_tech: string (python_fastapi, nodejs_express, etc.)
        - database: string (postgres, mongodb, none)
        - features: array of strings
        - complexity: string
        - has_authentication: boolean
        - has_realtime: boolean
        - has_deployment: boolean
        """
        
        response = await self._call_llm(prompt, context)
        
        try:
            # Parse JSON response
            data = self._extract_json(response)
            
            requirements = ProjectRequirements()
            requirements.project_type = data.get("project_type", "web_app")
            requirements.complexity = data.get("complexity", "medium")
            requirements.features = data.get("features", [])
            requirements.has_authentication = data.get("has_authentication", False)
            requirements.has_database = data.get("database", "none") != "none"
            requirements.has_realtime = data.get("has_realtime", False)
            requirements.has_deployment = data.get("has_deployment", False)
            
            # Map technologies
            if data.get("frontend_tech") == "vue":
                requirements.technologies.add(TechnologyStack.VUE_TYPESCRIPT)
            elif data.get("frontend_tech") == "react":
                requirements.technologies.add(TechnologyStack.REACT_TYPESCRIPT)
                
            if data.get("backend_tech") == "python_fastapi":
                requirements.technologies.add(TechnologyStack.PYTHON_FASTAPI)
            elif data.get("backend_tech") == "nodejs_express":
                requirements.technologies.add(TechnologyStack.NODEJS_EXPRESS)
                
            if data.get("database") == "postgres":
                requirements.technologies.add(TechnologyStack.DATABASE_POSTGRES)
            elif data.get("database") == "mongodb":
                requirements.technologies.add(TechnologyStack.DATABASE_MONGODB)
                
            if requirements.has_deployment:
                requirements.technologies.add(TechnologyStack.DOCKER)
                
            logger.info(f"Analyzed requirements: {requirements.project_type} with {len(requirements.technologies)} technologies")
            return requirements
            
        except Exception as e:
            logger.error(f"Failed to parse requirements: {e}")
            # Return default requirements
            return ProjectRequirements(
                project_type="web_app",
                technologies={TechnologyStack.PYTHON_FASTAPI, TechnologyStack.VUE_TYPESCRIPT}
            )
    
    def determine_required_agents(self, requirements: ProjectRequirements) -> List[str]:
        """Determine which agents are needed based on requirements"""
        required_agents = set()
        
        # Add agents based on technologies
        for tech in requirements.technologies:
            if tech in self.technology_mapping:
                required_agents.update(self.technology_mapping[tech])
        
        # Always include documentation and QA
        required_agents.add("technical_writer")
        if requirements.has_testing:
            required_agents.add("qa_engineer")
        
        # Add DevOps if deployment is needed
        if requirements.has_deployment:
            required_agents.add("devops_engineer")
        
        logger.info(f"Determined {len(required_agents)} required agents: {required_agents}")
        return list(required_agents)
    
    def create_agent(self, template_name: str, customizations: Optional[Dict[str, Any]] = None) -> AgentSpecification:
        """Create an agent from a template with optional customizations"""
        if template_name not in self.agent_templates:
            logger.error(f"Unknown agent template: {template_name}")
            raise ValueError(f"Unknown agent template: {template_name}")
        
        # Clone the template
        template = self.agent_templates[template_name]
        agent_spec = AgentSpecification(
            name=template.name,
            type=template.type,
            technologies=template.technologies.copy(),
            responsibilities=template.responsibilities.copy(),
            tools=template.tools.copy()
        )
        
        # Apply customizations
        if customizations:
            if "additional_responsibilities" in customizations:
                agent_spec.responsibilities.extend(customizations["additional_responsibilities"])
            if "additional_tools" in customizations:
                agent_spec.tools.extend(customizations["additional_tools"])
            if "context_requirements" in customizations:
                agent_spec.context_requirements.update(customizations["context_requirements"])
        
        # Add to pool
        self.agent_pool[agent_spec.agent_id] = agent_spec
        logger.info(f"Created agent: {agent_spec.name} (ID: {agent_spec.agent_id})")
        
        return agent_spec
    
    def configure_agent_dependencies(self, agents: List[AgentSpecification]):
        """Configure dependencies between agents"""
        # Frontend depends on backend
        frontend_agents = [a for a in agents if "frontend" in a.name.lower()]
        backend_agents = [a for a in agents if "backend" in a.name.lower()]
        
        for frontend in frontend_agents:
            for backend in backend_agents:
                frontend.dependencies.append(backend.agent_id)
        
        # Backend depends on database
        database_agents = [a for a in agents if "database" in a.name.lower()]
        for backend in backend_agents:
            for database in database_agents:
                backend.dependencies.append(database.agent_id)
        
        # All depend on technical writer for documentation
        writer_agents = [a for a in agents if "writer" in a.name.lower()]
        for agent in agents:
            if agent not in writer_agents:
                for writer in writer_agents:
                    agent.dependencies.append(writer.agent_id)
        
        logger.info("Configured agent dependencies")
    
    async def create_agent_pool(self, user_input: str, context: AgentContext) -> Dict[str, Any]:
        """Main method to create the agent pool for a project"""
        logger.info("Creating agent pool for project")
        
        # Analyze requirements
        requirements = await self.analyze_requirements(user_input, context)
        
        # Determine required agents
        required_agent_templates = self.determine_required_agents(requirements)
        
        # Create agents
        created_agents = []
        for template_name in required_agent_templates:
            agent_spec = self.create_agent(template_name)
            created_agents.append(agent_spec)
        
        # Configure dependencies
        self.configure_agent_dependencies(created_agents)
        
        # Create execution plan
        execution_plan = self.create_execution_plan(created_agents)
        
        result = {
            "requirements": {
                "project_type": requirements.project_type,
                "technologies": [t.value for t in requirements.technologies],
                "features": requirements.features,
                "complexity": requirements.complexity
            },
            "agents": [agent.to_dict() for agent in created_agents],
            "execution_plan": execution_plan,
            "estimated_time": self.estimate_completion_time(requirements, created_agents)
        }
        
        logger.info(f"Created agent pool with {len(created_agents)} agents")
        return result
    
    def create_execution_plan(self, agents: List[AgentSpecification]) -> Dict[str, Any]:
        """Create an execution plan for the agents"""
        phases = []
        
        # Phase 1: Setup and initialization
        setup_agents = [a for a in agents if "database" in a.name.lower() or "devops" in a.name.lower()]
        if setup_agents:
            phases.append({
                "phase": 1,
                "name": "Setup & Infrastructure",
                "agents": [a.agent_id for a in setup_agents],
                "parallel": True
            })
        
        # Phase 2: Backend development
        backend_agents = [a for a in agents if "backend" in a.name.lower()]
        if backend_agents:
            phases.append({
                "phase": 2,
                "name": "Backend Development",
                "agents": [a.agent_id for a in backend_agents],
                "parallel": False
            })
        
        # Phase 3: Frontend development
        frontend_agents = [a for a in agents if "frontend" in a.name.lower()]
        if frontend_agents:
            phases.append({
                "phase": 3,
                "name": "Frontend Development",
                "agents": [a.agent_id for a in frontend_agents],
                "parallel": False
            })
        
        # Phase 4: Testing and documentation
        qa_doc_agents = [a for a in agents if "qa" in a.name.lower() or "writer" in a.name.lower()]
        if qa_doc_agents:
            phases.append({
                "phase": 4,
                "name": "Testing & Documentation",
                "agents": [a.agent_id for a in qa_doc_agents],
                "parallel": True
            })
        
        return {
            "phases": phases,
            "total_phases": len(phases),
            "can_parallelize": True
        }
    
    async def _call_llm(self, prompt: str, context: AgentContext) -> str:
        """Mock LLM call for testing - returns sensible defaults"""
        # In production, this would call the actual LLM
        # For now, return mock responses for testing
        return json.dumps({
            "project_type": "web_application",
            "complexity": "medium",
            "technologies": ["python_fastapi", "vue_typescript", "postgres"],
            "features": [
                "User authentication",
                "Product catalog",
                "Shopping cart",
                "Order management",
                "Admin dashboard"
            ]
        })
    
    def estimate_completion_time(self, requirements: ProjectRequirements, agents: List[AgentSpecification]) -> str:
        """Estimate project completion time"""
        base_time = 30  # minutes
        
        # Add time based on complexity
        if requirements.complexity == "simple":
            base_time += 15
        elif requirements.complexity == "complex":
            base_time += 60
        else:
            base_time += 30
        
        # Add time for each agent
        base_time += len(agents) * 10
        
        # Add time for special features
        if requirements.has_authentication:
            base_time += 20
        if requirements.has_realtime:
            base_time += 30
        if requirements.has_deployment:
            base_time += 25
        
        if base_time < 60:
            return f"{base_time} minutes"
        else:
            hours = base_time // 60
            minutes = base_time % 60
            return f"{hours} hours {minutes} minutes"
    
    async def execute(self, input_data: str, context: AgentContext) -> Dict[str, Any]:
        """Execute the agent pool maker"""
        logger.info(f"Agent Pool Maker executing for session {context.session_id}")
        
        result = await self.create_agent_pool(input_data, context)
        
        # Store result in context for other agents
        context.variables["agent_pool"] = result["agents"]
        context.variables["execution_plan"] = result["execution_plan"]
        
        return {
            "status": "success",
            "agent": self.name,
            "result": result,
            "message": f"Created {len(result['agents'])} agents for your {result['requirements']['project_type']} project"
        }
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get status of all agents in the pool"""
        return {
            "total_agents": len(self.agent_pool),
            "agents": [
                {
                    "id": agent_id,
                    "name": spec.name,
                    "type": spec.type.value,
                    "status": "ready"
                }
                for agent_id, spec in self.agent_pool.items()
            ]
        }
    
    def remove_agent(self, agent_id: str) -> bool:
        """Remove an agent from the pool"""
        if agent_id in self.agent_pool:
            del self.agent_pool[agent_id]
            logger.info(f"Removed agent {agent_id} from pool")
            return True
        return False
    
    def update_agent_metrics(self, agent_id: str, metrics: Dict[str, float]):
        """Update performance metrics for an agent"""
        if agent_id in self.agent_pool:
            self.agent_pool[agent_id].performance_metrics.update(metrics)
            logger.info(f"Updated metrics for agent {agent_id}: {metrics}")