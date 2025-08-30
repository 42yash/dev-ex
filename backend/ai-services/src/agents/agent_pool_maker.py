"""
Agent Pool Maker (Agent 0) - Master Orchestrator
Creates and manages specialized agents based on project requirements
"""

import json
import logging
from typing import Dict, List, Optional, Any, Set
import asyncio
from datetime import datetime
import uuid

from .base import BaseAgent, AgentContext, AgentStatus, AgentType, AgentResult
from .execution_limiter import ExecutionLimiter
from .specifications import AgentSpecification, ProjectRequirements, TechnologyStack
from ..config import Config

logger = logging.getLogger(__name__)


class AgentPoolMaker(BaseAgent):
    """
    Agent 0 - Master orchestrator that creates and manages other agents
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None, model: Optional[Any] = None):
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
        self.model = model  # Store model for agent creation
        
        # Import and initialize agent factory (imported here to avoid circular import)
        from .factory import AgentFactory
        self.agent_factory = AgentFactory(config=config, model=model)
        
        self.agent_pool: Dict[str, AgentSpecification] = {}
        self.active_agents: Dict[str, BaseAgent] = {}  # Track instantiated agents
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
    
    async def instantiate_agents(self, specs: List[AgentSpecification]) -> List[BaseAgent]:
        """
        Convert agent specifications to actual agent instances
        
        Args:
            specs: List of agent specifications
            
        Returns:
            List of instantiated agents
        """
        instantiated_agents = []
        
        for spec in specs:
            try:
                # Create the agent using factory
                agent = self.agent_factory.create_agent(spec)
                
                # Store in active agents
                self.active_agents[spec.agent_id] = agent
                
                # Add to list
                instantiated_agents.append(agent)
                
                logger.info(f"Instantiated agent: {spec.name} (ID: {spec.agent_id})")
                
            except Exception as e:
                logger.error(f"Failed to instantiate agent {spec.name}: {e}")
                # Continue with other agents even if one fails
                continue
        
        return instantiated_agents
    
    async def execute_pool(self, execution_plan: Dict[str, Any], context: AgentContext) -> Dict[str, Any]:
        """
        Execute agents according to the execution plan
        
        Args:
            execution_plan: Plan with phases and agent assignments
            context: Execution context
            
        Returns:
            Execution results
        """
        results = {
            "phases": [],
            "overall_success": True,
            "completed_agents": [],
            "failed_agents": []
        }
        
        for phase in execution_plan['phases']:
            phase_results = {
                "phase": phase['phase'],
                "name": phase['name'],
                "agents": [],
                "success": True
            }
            
            if phase['parallel']:
                # Execute agents in parallel
                agent_results = await self._execute_parallel(phase['agents'], context)
            else:
                # Execute agents sequentially
                agent_results = await self._execute_sequential(phase['agents'], context)
            
            # Process results
            for agent_id, result in agent_results.items():
                if result.success:
                    results["completed_agents"].append(agent_id)
                else:
                    results["failed_agents"].append(agent_id)
                    phase_results["success"] = False
                    results["overall_success"] = False
                
                phase_results["agents"].append({
                    "agent_id": agent_id,
                    "success": result.success,
                    "output": result.output,
                    "error": result.error
                })
            
            results["phases"].append(phase_results)
            
            # Stop if phase failed and we can't continue
            if not phase_results["success"] and not execution_plan.get('continue_on_failure', False):
                logger.warning(f"Phase {phase['name']} failed, stopping execution")
                break
        
        return results
    
    async def _execute_parallel(self, agent_ids: List[str], context: AgentContext) -> Dict[str, AgentResult]:
        """
        Execute multiple agents in parallel
        
        Args:
            agent_ids: List of agent IDs to execute
            context: Execution context
            
        Returns:
            Dictionary of agent results
        """
        tasks = []
        for agent_id in agent_ids:
            agent = self.active_agents.get(agent_id)
            if agent:
                # Create task for agent execution
                task = asyncio.create_task(
                    self._execute_single_agent(agent, context)
                )
                tasks.append((agent_id, task))
            else:
                logger.warning(f"Agent {agent_id} not found in active agents")
        
        # Wait for all tasks to complete
        results = {}
        for agent_id, task in tasks:
            try:
                result = await task
                results[agent_id] = result
            except Exception as e:
                logger.error(f"Agent {agent_id} execution failed: {e}")
                results[agent_id] = AgentResult(
                    success=False,
                    output=None,
                    error=str(e)
                )
        
        return results
    
    async def _execute_sequential(self, agent_ids: List[str], context: AgentContext) -> Dict[str, AgentResult]:
        """
        Execute multiple agents sequentially
        
        Args:
            agent_ids: List of agent IDs to execute
            context: Execution context
            
        Returns:
            Dictionary of agent results
        """
        results = {}
        
        for agent_id in agent_ids:
            agent = self.active_agents.get(agent_id)
            if agent:
                try:
                    result = await self._execute_single_agent(agent, context)
                    results[agent_id] = result
                    
                    # Pass output to next agent via context
                    if result.success and result.output:
                        context.variables[f"{agent_id}_output"] = result.output
                        
                except Exception as e:
                    logger.error(f"Agent {agent_id} execution failed: {e}")
                    results[agent_id] = AgentResult(
                        success=False,
                        output=None,
                        error=str(e)
                    )
            else:
                logger.warning(f"Agent {agent_id} not found in active agents")
                results[agent_id] = AgentResult(
                    success=False,
                    output=None,
                    error="Agent not found"
                )
        
        return results
    
    async def _execute_single_agent(self, agent: BaseAgent, context: AgentContext) -> AgentResult:
        """
        Execute a single agent with proper error handling
        
        Args:
            agent: The agent to execute
            context: Execution context
            
        Returns:
            Agent result
        """
        try:
            # Use execution limiter if available
            if self.execution_limiter:
                execution_id = f"{agent.name}_{uuid.uuid4().hex[:8]}"
                result = await self.execution_limiter.execute_with_limits(
                    execution_id,
                    agent.execute,
                    context.variables.get('input', ''),
                    context
                )
            else:
                # Direct execution
                result = await agent.execute(
                    context.variables.get('input', ''),
                    context
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing agent {agent.name}: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e)
            )
    
    def cleanup_pool(self):
        """Clean up all active agents and free resources"""
        logger.info(f"Cleaning up agent pool with {len(self.active_agents)} active agents")
        
        # Clear active agents
        self.active_agents.clear()
        
        # Clear specifications
        self.agent_pool.clear()
        
        logger.info("Agent pool cleaned up")
    
    def update_agent_metrics(self, agent_id: str, metrics: Dict[str, float]):
        """Update performance metrics for an agent"""
        if agent_id in self.agent_pool:
            self.agent_pool[agent_id].performance_metrics.update(metrics)
            logger.info(f"Updated metrics for agent {agent_id}: {metrics}")