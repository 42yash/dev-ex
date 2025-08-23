"""
Agent Manager for orchestrating agent interactions
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

import google.generativeai as genai

from .base import BaseAgent, AgentContext, AgentResult, AgentType, ConversationalAgent
from .architect import ArchitectAgent
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
        self.agents: Dict[str, BaseAgent] = {}
        self.model = None
        
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
        
        # Initialize core agents
        await self._initialize_core_agents()
        
        # Load custom agents from database
        await self._load_custom_agents()
        
        logger.info(f"Initialized {len(self.agents)} agents")
    
    async def _initialize_core_agents(self):
        """Initialize the core built-in agents"""
        
        # Agent 0: The Architect
        architect = ArchitectAgent(model=self.model)
        self.register_agent(architect)
        
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
        
        # Add more core agents as needed
    
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
            
            # Create appropriate agent based on type
            if agent_type in [AgentType.CREATIVE, AgentType.DOCUMENTATION]:
                agent = ConversationalAgent(
                    name=agent_data['name'],
                    agent_type=agent_type,
                    system_prompt=agent_data['system_prompt'],
                    model=self.model,
                    config=agent_data.get('config', {})
                )
            else:
                # Default to base conversational agent
                agent = ConversationalAgent(
                    name=agent_data['name'],
                    agent_type=agent_type,
                    system_prompt=agent_data['system_prompt'],
                    model=self.model,
                    config=agent_data.get('config', {})
                )
            
            self.register_agent(agent)
            logger.info(f"Loaded agent from database: {agent_data['name']}")
            
        except Exception as e:
            logger.error(f"Failed to create agent {agent_data['name']}: {e}")
    
    def register_agent(self, agent: BaseAgent):
        """Register an agent with the manager"""
        self.agents[agent.name] = agent
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
        """Execute a specific agent"""
        agent = self.get_agent(agent_name)
        if not agent:
            logger.error(f"Agent not found: {agent_name}")
            return AgentResult(
                success=False,
                output=None,
                error=f"Agent '{agent_name}' not found"
            )
        
        # Add agent to context history
        context.previous_agents.append(agent_name)
        
        # Check cache for similar requests
        cache_key = f"agent:{agent_name}:{hash(str(input_data))}"
        cached_result = await self.cache.get(cache_key)
        if cached_result:
            logger.info(f"Using cached result for agent {agent_name}")
            return AgentResult(**json.loads(cached_result))
        
        # Execute agent
        logger.info(f"Executing agent: {agent_name}")
        result = await agent.execute(input_data, context)
        
        # Store execution in database
        await self._store_execution(agent_name, context, input_data, result)
        
        # Cache successful results
        if result.success:
            await self.cache.set(
                cache_key,
                json.dumps({
                    "success": result.success,
                    "output": result.output,
                    "metadata": result.metadata
                }),
                ttl=300  # Cache for 5 minutes
            )
        
        return result
    
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
                json.dumps(input_data) if not isinstance(input_data, str) else input_data,
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
            return {
                "content": result.output,
                "widgets": [],  # TODO: Implement widget generation
                "suggested_actions": [],
                "metadata": result.metadata
            }
        else:
            return {
                "content": "I apologize, but I encountered an error processing your request. Please try again.",
                "error": result.error,
                "metadata": {}
            }
    
    async def shutdown(self):
        """Shutdown the agent manager"""
        logger.info("Shutting down Agent Manager...")
        # Cleanup resources if needed