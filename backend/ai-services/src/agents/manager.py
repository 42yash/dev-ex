"""
Agent Manager for orchestrating agent interactions
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import uuid
from collections import OrderedDict

import google.generativeai as genai

from .base import BaseAgent, AgentContext, AgentResult, AgentType, ConversationalAgent
from .architect import ArchitectAgent
from .idea_generator import IdeaGeneratorAgent
from .technical_writer import TechnicalWriterAgent
from .agent_pool_maker import AgentPoolMaker
from .specifications import AgentSpecification
from .agent_darwin import AgentDarwin
from .factory import AgentFactory
from .execution_limiter import ExecutionLimiter, CircuitBreaker
from .orchestrator import WorkflowOrchestrator
from ..config import Config
from ..db.connection import DatabaseManager
from ..cache.redis_client import RedisCache

logger = logging.getLogger(__name__)


class AgentManager:
    """Manages all agents and their interactions"""
    
    def __init__(
        self,
        config: Config,
        db_manager: DatabaseManager,
        cache: RedisCache
    ):
        self.config = config
        self.db_manager = db_manager
        self.cache = cache
        self.agents: OrderedDict[str, BaseAgent] = OrderedDict()
        self.model = None
        
        # Initialize execution limiter
        self.execution_limiter = ExecutionLimiter(
            max_execution_time=float(config.gemini.timeout),
            max_memory_mb=512,
            max_concurrent_executions=10,
            history_size=100
        )
        
        # Initialize circuit breakers for each agent type
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        
        # Limit number of agents to prevent memory issues
        self.max_agents = 50
        
        # Initialize workflow orchestrator (will be set in initialize)
        self.workflow_orchestrator = None
        
        # Initialize agent factory
        self.agent_factory = None
        
        # Track dynamic agent pools
        self.dynamic_pools: Dict[str, Dict[str, Any]] = {}
        
    async def initialize(self):
        """Initialize the agent manager and all agents"""
        logger.info("Initializing Agent Manager...")
        
        # Configure Gemini
        if self.config.gemini.api_key:
            genai.configure(api_key=self.config.gemini.api_key)
            self.model = genai.GenerativeModel(
                self.config.gemini.model,
                generation_config={
                    "temperature": self.config.gemini.temperature,
                    "max_output_tokens": self.config.gemini.max_tokens,
                }
            )
            logger.info(f"Configured Gemini model: {self.config.gemini.model}")
        else:
            logger.warning("No Gemini API key configured - agents will run in limited mode")
        
        # Initialize agent factory
        self.agent_factory = AgentFactory(config=self.config, model=self.model)
        logger.info("Initialized Agent Factory")
        
        # Initialize core agents
        await self._initialize_core_agents()
        
        # Load custom agents from database
        await self._load_custom_agents()
        
        # Initialize workflow orchestrator
        pool_maker = self.get_agent("agent_pool_maker")
        darwin = self.get_agent("agent_darwin")
        if pool_maker and darwin:
            self.workflow_orchestrator = WorkflowOrchestrator(
                config=self.config,
                db_manager=self.db_manager,
                cache=self.cache,
                agent_pool_maker=pool_maker,
                agent_darwin=darwin
            )
            await self.workflow_orchestrator.initialize()
            logger.info("Initialized Workflow Orchestrator")
        
        logger.info(f"Initialized {len(self.agents)} agents")
    
    async def _initialize_core_agents(self):
        """Initialize the core built-in agents"""
        
        # Agent 0: The Architect
        architect = ArchitectAgent(model=self.model)
        self.register_agent(architect)
        
        # Agent 1: The Idea Generator
        idea_generator = IdeaGeneratorAgent(model=self.model)
        self.register_agent(idea_generator)
        
        # Agent 2: The Technical Writer
        technical_writer = TechnicalWriterAgent(model=self.model)
        self.register_agent(technical_writer)
        
        # Agent Pool Maker (Agent 0) - Master Orchestrator
        agent_pool_maker = AgentPoolMaker(
            config=self.config,
            execution_limiter=self.execution_limiter,
            model=self.model
        )
        self.register_agent(agent_pool_maker)
        
        # Agent Darwin - Evolution System
        agent_darwin = AgentDarwin(
            config=self.config,
            execution_limiter=self.execution_limiter
        )
        self.register_agent(agent_darwin)
        
        # Basic Chat Agent
        chat_agent = ConversationalAgent(
            name="chat",
            agent_type=AgentType.CREATIVE,
            system_prompt="""You are a helpful AI assistant for the Dev-Ex platform. 
            You help users with software development questions, provide guidance on best practices, 
            and assist with technical documentation.""",
            model=self.model
        )
        self.register_agent(chat_agent)
    
    async def _load_custom_agents(self):
        """Load custom agents from the database"""
        try:
            # Query agents from database
            query = """
                SELECT id, name, type, version, system_prompt, config, is_active
                FROM agents
                WHERE is_active = true
            """
            
            agents_data = await self.db_manager.query(query)
            
            for agent_data in agents_data:
                if agent_data['name'] not in ['architect', 'chat']:  # Skip core agents
                    await self._create_agent_from_db(agent_data)
                    
        except Exception as e:
            logger.error(f"Failed to load custom agents: {e}")
    
    async def _create_agent_from_db(self, agent_data: Dict[str, Any]):
        """Create an agent instance from database data"""
        try:
            agent_type = AgentType(agent_data['type'])
            
            # Parse config if it's a string (JSON)
            config = agent_data.get('config', {})
            if isinstance(config, str):
                try:
                    config = json.loads(config) if config else {}
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in config for agent {agent_data['name']}")
                    config = {}
            
            # Create appropriate agent based on type
            if agent_type in [AgentType.CREATIVE, AgentType.DOCUMENTATION]:
                agent = ConversationalAgent(
                    name=agent_data['name'],
                    agent_type=agent_type,
                    system_prompt=agent_data['system_prompt'],
                    model=self.model,
                    config=config
                )
            else:
                # Default to base conversational agent
                agent = ConversationalAgent(
                    name=agent_data['name'],
                    agent_type=agent_type,
                    system_prompt=agent_data['system_prompt'],
                    model=self.model,
                    config=config
                )
            
            self.register_agent(agent)
            logger.info(f"Loaded agent from database: {agent_data['name']}")
            
        except Exception as e:
            logger.error(f"Failed to create agent {agent_data['name']}: {e}")
    
    def register_agent(self, agent: BaseAgent):
        """Register an agent with the manager"""
        # Check agent limit
        if len(self.agents) >= self.max_agents:
            # Remove oldest agent if we're at capacity
            oldest_agent = next(iter(self.agents))
            logger.warning(f"Agent limit reached, removing oldest agent: {oldest_agent}")
            del self.agents[oldest_agent]
            if oldest_agent in self.circuit_breakers:
                del self.circuit_breakers[oldest_agent]
        
        self.agents[agent.name] = agent
        
        # Create circuit breaker for this agent
        self.circuit_breakers[agent.name] = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60
        )
        
        logger.info(f"Registered agent: {agent.name}")
    
    def get_agent(self, name: str) -> Optional[BaseAgent]:
        """Get an agent by name"""
        return self.agents.get(name)
    
    async def execute_agent(
        self,
        agent_name: str,
        input_data: Any,
        context: AgentContext
    ) -> AgentResult:
        """Execute a specific agent with resource limits"""
        agent = self.get_agent(agent_name)
        if not agent:
            logger.error(f"Agent not found: {agent_name}")
            return AgentResult(
                success=False,
                output=None,
                error=f"Agent '{agent_name}' not found"
            )
        
        # Limit context history to prevent unbounded growth
        if len(context.previous_agents) > 20:
            context.previous_agents = context.previous_agents[-20:]
        
        # Add agent to context history
        context.previous_agents.append(agent_name)
        
        # Check cache for similar requests
        input_hash = str(hash(str(input_data)))
        cached_result = await self.cache.get_agent_result(agent_name, input_hash)
        if cached_result:
            logger.info(f"Using cached result for agent {agent_name}")
            return AgentResult(**cached_result)
        
        # Execute agent with limiter and circuit breaker
        execution_id = f"{agent_name}_{uuid.uuid4().hex[:8]}"
        
        try:
            # Use circuit breaker
            circuit_breaker = self.circuit_breakers.get(agent_name)
            if circuit_breaker:
                logger.info(f"Executing agent {agent_name} with circuit breaker")
                result = await circuit_breaker.call(
                    self.execution_limiter.execute_with_limits,
                    execution_id,
                    agent.execute,
                    input_data,
                    context
                )
            else:
                # Execute with limiter only
                result = await self.execution_limiter.execute_with_limits(
                    execution_id,
                    agent.execute,
                    input_data,
                    context
                )
            
            # Store execution in database
            await self._store_execution(agent_name, context, input_data, result)
            
            # Cache successful results
            if result.success:
                await self.cache.set_agent_result(
                    agent_name,
                    input_hash,
                    {
                        "success": result.success,
                        "output": result.output,
                        "metadata": result.metadata
                    }
                )
            
            return result
            
        except TimeoutError as e:
            logger.error(f"Agent {agent_name} execution timed out: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=f"Execution timed out after {self.execution_limiter.max_execution_time}s"
            )
        except Exception as e:
            logger.error(f"Agent {agent_name} execution failed: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e)
            )
    
    async def _store_execution(
        self,
        agent_name: str,
        context: AgentContext,
        input_data: Any,
        result: AgentResult
    ):
        """Store agent execution in database"""
        try:
            query = """
                INSERT INTO agent_executions 
                (agent_id, session_id, input, output, status, completed_at, error, metadata)
                SELECT 
                    a.id, $2, $3, $4, $5, $6, $7, $8
                FROM agents a
                WHERE a.name = $1
            """
            
            status = "completed" if result.success else "failed"
            
            await self.db_manager.execute(
                query,
                agent_name,
                context.session_id,
                json.dumps(input_data),  # Always JSON encode
                json.dumps(result.output) if result.output else None,
                status,
                datetime.utcnow(),
                result.error,
                json.dumps(result.metadata)
            )
            
        except Exception as e:
            logger.error(f"Failed to store agent execution: {e}")
    
    async def create_conversation_agent(
        self,
        session_id: str,
        user_id: str
    ) -> ConversationalAgent:
        """Create a conversation agent for a session"""
        
        # Check if we already have an agent for this session
        cache_key = f"session_agent:{session_id}"
        agent_name = await self.cache.get(cache_key)
        
        if agent_name and agent_name in self.agents:
            return self.agents[agent_name]
        
        # Create new conversation agent for the session
        agent = ConversationalAgent(
            name=f"session_{session_id}",
            agent_type=AgentType.CREATIVE,
            system_prompt="""You are a helpful AI assistant in the Dev-Ex platform.
            You assist with software development, architecture design, and technical documentation.
            Provide clear, actionable guidance and best practices.""",
            model=self.model
        )
        
        self.register_agent(agent)
        
        # Cache the agent name for this session
        await self.cache.set(cache_key, agent.name, ttl=3600)
        
        return agent
    
    async def process_chat_message(
        self,
        session_id: str,
        user_id: str,
        message: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process a chat message through the appropriate agent"""
        
        # Create context
        context = AgentContext(
            session_id=session_id,
            user_id=user_id,
            variables=options or {}
        )
        
        # Get or create conversation agent
        agent = await self.create_conversation_agent(session_id, user_id)
        
        # Execute agent
        result = await self.execute_agent(agent.name, message, context)
        
        if result.success:
            # Extract the response text from the structured output
            content = result.output
            if isinstance(content, dict) and "response" in content:
                content = content["response"]
            elif isinstance(content, str):
                # Try to parse as JSON and extract response
                try:
                    import json
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "response" in parsed:
                        content = parsed["response"]
                except:
                    pass  # Keep original content if not JSON
            
            # Parse response to generate widgets
            from ..utils.response_parser import ResponseParser
            parser = ResponseParser()
            parsed_response = parser.parse_response(content, context.variables)
            
            # Check if this is asking about building something
            if any(phrase in message.lower() for phrase in ['build', 'create', 'develop', 'make']):
                # Return structured response with widgets
                return {
                    "content": content if content else "I can help you with that! Here's a workflow to get started:",  # Always include content
                    "widgets": parsed_response.get("widgets", []),
                    "suggested_actions": [
                        {
                            "id": "start_workflow",
                            "label": "Start Workflow",
                            "action": "create_workflow"
                        }
                    ],
                    "metadata": parsed_response.get("metadata", {})
                }
            else:
                # Return response with optional widgets
                return {
                    "content": content if content else "Here's the information you requested:",  # Always include content
                    "widgets": parsed_response.get("widgets", []),
                    "suggested_actions": [],
                    "metadata": result.metadata
                }
        else:
            return {
                "content": "I apologize, but I encountered an error processing your request. Please try again.",
                "error": result.error,
                "metadata": {}
            }
    
    async def create_workflow(self, user_input: str, session_id: str, user_id: str, options: Optional[Dict[str, Any]] = None):
        """Create a workflow from user input"""
        if not self.workflow_orchestrator:
            logger.error("Workflow orchestrator not initialized")
            return None
        
        return await self.workflow_orchestrator.create_workflow(
            user_input=user_input,
            session_id=session_id,
            user_id=user_id,
            options=options
        )
    
    async def execute_workflow(self, workflow_id: str):
        """Execute a workflow"""
        if not self.workflow_orchestrator:
            logger.error("Workflow orchestrator not initialized")
            return {"error": "Workflow orchestrator not available"}
        
        return await self.workflow_orchestrator.execute_workflow(workflow_id)
    
    async def get_workflow_status(self, workflow_id: str):
        """Get workflow status"""
        if not self.workflow_orchestrator:
            return {"error": "Workflow orchestrator not available"}
        
        return await self.workflow_orchestrator.get_workflow_status(workflow_id)
    
    async def shutdown(self):
        """Shutdown the agent manager"""
        logger.info("Shutting down Agent Manager...")
        
        # Shutdown workflow orchestrator
        if self.workflow_orchestrator:
            await self.workflow_orchestrator.shutdown()
        
        # Clean up execution limiter
        self.execution_limiter.cleanup()
        
        # Clean up agents
        self.agents.clear()
        self.circuit_breakers.clear()
        
        # Force garbage collection
        import gc
        gc.collect()
        
        logger.info("Agent Manager shutdown complete")
    
    def get_execution_stats(self) -> Dict[str, Any]:
        """Get execution statistics"""
        return {
            "agents_registered": len(self.agents),
            "execution_stats": self.execution_limiter.get_stats(),
            "circuit_breakers": {
                name: cb.state 
                for name, cb in self.circuit_breakers.items()
            }
        }
    
    async def create_dynamic_pool(self, user_input: str, context: AgentContext) -> str:
        """
        Create and manage a dynamic agent pool based on user requirements
        
        Args:
            user_input: User's project requirements
            context: Execution context
            
        Returns:
            Pool ID for tracking
        """
        logger.info(f"Creating dynamic agent pool for session {context.session_id}")
        
        # Get the agent pool maker
        pool_maker = self.get_agent("agent_pool_maker")
        if not pool_maker:
            raise ValueError("Agent Pool Maker not available")
        
        # Create the agent pool specifications
        pool_result = await pool_maker.create_agent_pool(user_input, context)
        
        # Extract agent specifications
        agent_specs = []
        for agent_dict in pool_result['agents']:
            spec = AgentSpecification(
                agent_id=agent_dict['agent_id'],
                name=agent_dict['name'],
                type=AgentType[agent_dict['type'].upper()] if isinstance(agent_dict['type'], str) else agent_dict['type'],
                technologies=agent_dict.get('technologies', []),
                responsibilities=agent_dict.get('responsibilities', []),
                dependencies=agent_dict.get('dependencies', []),
                tools=agent_dict.get('tools', []),
                context_requirements=agent_dict.get('context_requirements', {})
            )
            agent_specs.append(spec)
        
        # Instantiate actual agents
        instantiated_agents = await pool_maker.instantiate_agents(agent_specs)
        
        # Register all agents with the manager
        for agent in instantiated_agents:
            self.register_agent(agent)
        
        # Generate pool ID
        pool_id = str(uuid.uuid4())
        
        # Store pool information
        self.dynamic_pools[pool_id] = {
            'pool_id': pool_id,
            'created_at': datetime.utcnow(),
            'user_input': user_input,
            'agents': [agent.name for agent in instantiated_agents],
            'agent_specs': agent_specs,
            'execution_plan': pool_result['execution_plan'],
            'requirements': pool_result['requirements'],
            'estimated_time': pool_result.get('estimated_time', 'Unknown'),
            'status': 'created'
        }
        
        logger.info(f"Created dynamic pool {pool_id} with {len(instantiated_agents)} agents")
        return pool_id
    
    async def execute_dynamic_pool(self, pool_id: str, context: AgentContext) -> Dict[str, Any]:
        """
        Execute a dynamic agent pool
        
        Args:
            pool_id: Pool identifier
            context: Execution context
            
        Returns:
            Execution results
        """
        pool = self.dynamic_pools.get(pool_id)
        if not pool:
            raise ValueError(f"Pool {pool_id} not found")
        
        logger.info(f"Executing dynamic pool {pool_id}")
        
        # Update pool status
        pool['status'] = 'executing'
        pool['started_at'] = datetime.utcnow()
        
        # Get the pool maker to execute
        pool_maker = self.get_agent("agent_pool_maker")
        if not pool_maker:
            raise ValueError("Agent Pool Maker not available")
        
        # Execute the pool
        try:
            results = await pool_maker.execute_pool(pool['execution_plan'], context)
            
            # Update pool status
            pool['status'] = 'completed' if results['overall_success'] else 'failed'
            pool['completed_at'] = datetime.utcnow()
            pool['results'] = results
            
            logger.info(f"Pool {pool_id} execution {'succeeded' if results['overall_success'] else 'failed'}")
            
            return results
            
        except Exception as e:
            logger.error(f"Pool {pool_id} execution failed: {e}")
            pool['status'] = 'error'
            pool['error'] = str(e)
            raise
    
    def get_pool_status(self, pool_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a dynamic pool
        
        Args:
            pool_id: Pool identifier
            
        Returns:
            Pool status information
        """
        pool = self.dynamic_pools.get(pool_id)
        if not pool:
            return None
        
        return {
            'pool_id': pool_id,
            'status': pool['status'],
            'created_at': pool['created_at'].isoformat() if isinstance(pool['created_at'], datetime) else pool['created_at'],
            'agents': pool['agents'],
            'requirements': pool['requirements'],
            'estimated_time': pool['estimated_time'],
            'started_at': pool.get('started_at', '').isoformat() if pool.get('started_at') and isinstance(pool.get('started_at'), datetime) else pool.get('started_at'),
            'completed_at': pool.get('completed_at', '').isoformat() if pool.get('completed_at') and isinstance(pool.get('completed_at'), datetime) else pool.get('completed_at'),
            'results': pool.get('results', {})
        }
    
    def list_dynamic_pools(self) -> List[Dict[str, Any]]:
        """
        List all dynamic pools
        
        Returns:
            List of pool summaries
        """
        pools = []
        for pool_id, pool in self.dynamic_pools.items():
            pools.append({
                'pool_id': pool_id,
                'status': pool['status'],
                'created_at': pool['created_at'].isoformat() if isinstance(pool['created_at'], datetime) else pool['created_at'],
                'agent_count': len(pool['agents']),
                'project_type': pool['requirements'].get('project_type', 'Unknown')
            })
        
        return pools
    
    async def cleanup_pool(self, pool_id: str):
        """
        Clean up a dynamic pool and free resources
        
        Args:
            pool_id: Pool identifier
        """
        pool = self.dynamic_pools.get(pool_id)
        if not pool:
            logger.warning(f"Pool {pool_id} not found for cleanup")
            return
        
        logger.info(f"Cleaning up pool {pool_id}")
        
        # Get pool maker for cleanup
        pool_maker = self.get_agent("agent_pool_maker")
        if pool_maker:
            pool_maker.cleanup_pool()
        
        # Remove agents from registry (optional - they can be reused)
        # for agent_name in pool['agents']:
        #     if agent_name in self.agents:
        #         del self.agents[agent_name]
        
        # Remove pool from tracking
        del self.dynamic_pools[pool_id]
        
        logger.info(f"Pool {pool_id} cleaned up")