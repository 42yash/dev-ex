"""
Agent Factory for dynamic agent creation
Creates agent instances at runtime based on specifications
"""

import logging
from typing import Dict, Type, Optional, Any, List
from dataclasses import dataclass
import importlib
import inspect

from .base import BaseAgent, AgentType, ConversationalAgent
from .code_reviewer import CodeReviewAgent
from .testing_agent import TestingAgent
from .git_agent import GitAgent
from .scaffolder import ScaffolderAgent
from .technical_writer import TechnicalWriterAgent
from .architect import ArchitectAgent
from .idea_generator import IdeaGeneratorAgent
# Communication agent not yet implemented
from .specifications import AgentSpecification
from ..config import Config

logger = logging.getLogger(__name__)


class AgentFactory:
    """Factory for creating agent instances dynamically"""
    
    def __init__(self, config: Config, model: Optional[Any] = None):
        """
        Initialize the agent factory
        
        Args:
            config: Application configuration
            model: LLM model instance for agents that need it
        """
        self.config = config
        self.model = model
        
        # Registry of available agent classes
        self.agent_registry: Dict[str, Type[BaseAgent]] = {
            # Code-related agents
            'code_reviewer': CodeReviewAgent,
            'testing_agent': TestingAgent,
            'git_agent': GitAgent,
            'scaffolder': ScaffolderAgent,
            
            # Documentation and design
            'technical_writer': TechnicalWriterAgent,
            'architect': ArchitectAgent,
            'idea_generator': IdeaGeneratorAgent,
            
            # Communication (placeholder for future implementation)
            # 'communication': CommunicationAgent,
            
            # Generic conversational agent (can be configured for any purpose)
            'conversational': ConversationalAgent,
        }
        
        # Agent configuration templates
        self.agent_configs: Dict[str, Dict[str, Any]] = {
            'python_backend': {
                'base_class': 'scaffolder',
                'config': {
                    'language': 'python',
                    'framework': 'fastapi',
                    'include_tests': True,
                    'include_docker': True
                }
            },
            'frontend_vue': {
                'base_class': 'scaffolder',
                'config': {
                    'language': 'typescript',
                    'framework': 'vue',
                    'include_tests': True,
                    'include_styles': True
                }
            },
            'frontend_react': {
                'base_class': 'scaffolder',
                'config': {
                    'language': 'typescript',
                    'framework': 'react',
                    'include_tests': True,
                    'include_styles': True
                }
            },
            'database_designer': {
                'base_class': 'conversational',
                'config': {
                    'system_prompt': """You are a database design expert. You help design efficient,
                    scalable database schemas. You understand normalization, indexing strategies,
                    query optimization, and can work with SQL and NoSQL databases.""",
                    'agent_type': AgentType.ANALYSIS
                }
            },
            'devops_engineer': {
                'base_class': 'conversational',
                'config': {
                    'system_prompt': """You are a DevOps engineer specializing in CI/CD, containerization,
                    and cloud deployment. You can create Docker configurations, Kubernetes manifests,
                    CI/CD pipelines, and infrastructure as code.""",
                    'agent_type': AgentType.DEPLOYMENT
                }
            },
            'qa_engineer': {
                'base_class': 'testing_agent',
                'config': {
                    'test_frameworks': ['pytest', 'jest', 'mocha', 'junit'],
                    'include_e2e': True,
                    'include_integration': True
                }
            },
            'security_analyst': {
                'base_class': 'code_reviewer',
                'config': {
                    'focus': 'security',
                    'check_vulnerabilities': True,
                    'check_dependencies': True
                }
            },
            'performance_optimizer': {
                'base_class': 'conversational',
                'config': {
                    'system_prompt': """You are a performance optimization expert. You analyze code
                    for performance bottlenecks, suggest optimizations, and help with caching strategies,
                    query optimization, and algorithmic improvements.""",
                    'agent_type': AgentType.ANALYSIS
                }
            }
        }
        
        logger.info(f"Initialized AgentFactory with {len(self.agent_registry)} agent types")
    
    def create_agent(self, spec: AgentSpecification) -> BaseAgent:
        """
        Create an agent instance from specification
        
        Args:
            spec: Agent specification with requirements
            
        Returns:
            Instantiated agent
            
        Raises:
            ValueError: If agent type is not found or cannot be created
        """
        # Determine the base agent class to use
        agent_class = self._determine_agent_class(spec)
        
        if not agent_class:
            raise ValueError(f"Cannot determine agent class for: {spec.name}")
        
        # Prepare configuration
        agent_config = self._prepare_agent_config(spec)
        
        # Create the agent instance
        try:
            agent = self._instantiate_agent(agent_class, spec, agent_config)
            logger.info(f"Created agent: {spec.name} (type: {agent_class.__name__})")
            return agent
            
        except Exception as e:
            logger.error(f"Failed to create agent {spec.name}: {e}")
            raise ValueError(f"Failed to create agent {spec.name}: {e}")
    
    def _determine_agent_class(self, spec: AgentSpecification) -> Optional[Type[BaseAgent]]:
        """
        Determine which agent class to use based on specification
        
        Args:
            spec: Agent specification
            
        Returns:
            Agent class or None if not found
        """
        # First, check if there's a direct mapping from the spec name
        name_lower = spec.name.lower()
        
        # Check for exact matches in registry
        for key, agent_class in self.agent_registry.items():
            if key in name_lower:
                return agent_class
        
        # Check agent configs for template matches
        for template_name, template_config in self.agent_configs.items():
            if template_name in name_lower:
                base_class_name = template_config.get('base_class')
                if base_class_name in self.agent_registry:
                    return self.agent_registry[base_class_name]
        
        # Check based on agent type
        if spec.type == AgentType.CODE:
            return self.agent_registry.get('scaffolder')
        elif spec.type == AgentType.TESTING:
            return self.agent_registry.get('testing_agent')
        elif spec.type == AgentType.DOCUMENTATION:
            return self.agent_registry.get('technical_writer')
        elif spec.type == AgentType.ANALYSIS:
            return self.agent_registry.get('code_reviewer')
        
        # Default to conversational agent
        return self.agent_registry.get('conversational')
    
    def _prepare_agent_config(self, spec: AgentSpecification) -> Dict[str, Any]:
        """
        Prepare configuration for agent instantiation
        
        Args:
            spec: Agent specification
            
        Returns:
            Configuration dictionary
        """
        config = {}
        
        # Check if there's a template configuration
        name_lower = spec.name.lower()
        for template_name, template_config in self.agent_configs.items():
            if template_name in name_lower:
                config.update(template_config.get('config', {}))
                break
        
        # Add spec's context requirements
        config.update(spec.context_requirements)
        
        # Add common configuration
        config['agent_id'] = spec.agent_id
        config['responsibilities'] = spec.responsibilities
        config['tools'] = spec.tools
        
        return config
    
    def _instantiate_agent(
        self,
        agent_class: Type[BaseAgent],
        spec: AgentSpecification,
        config: Dict[str, Any]
    ) -> BaseAgent:
        """
        Instantiate an agent with proper parameters
        
        Args:
            agent_class: The agent class to instantiate
            spec: Agent specification
            config: Configuration dictionary
            
        Returns:
            Instantiated agent
        """
        # Get the constructor signature
        sig = inspect.signature(agent_class.__init__)
        params = sig.parameters
        
        # Prepare constructor arguments
        kwargs = {}
        
        # Common parameters that most agents accept
        if 'config' in params and self.config:
            kwargs['config'] = self.config
        
        if 'model' in params and self.model:
            kwargs['model'] = self.model
        
        if 'name' in params:
            kwargs['name'] = spec.name
        
        if 'agent_type' in params:
            kwargs['agent_type'] = spec.type
        
        # For ConversationalAgent, add system prompt if available
        if agent_class == ConversationalAgent:
            if 'system_prompt' in config:
                kwargs['system_prompt'] = config['system_prompt']
            else:
                # Generate a system prompt based on responsibilities
                kwargs['system_prompt'] = self._generate_system_prompt(spec)
        
        # Try to instantiate the agent
        try:
            agent = agent_class(**kwargs)
            
            # Set additional attributes
            if hasattr(agent, 'agent_id'):
                agent.agent_id = spec.agent_id
            
            # Store the full configuration
            if hasattr(agent, 'custom_config'):
                agent.custom_config = config
            
            return agent
            
        except TypeError as e:
            # If instantiation fails, try with minimal parameters
            logger.warning(f"Failed with full params, trying minimal: {e}")
            
            # Try minimal instantiation
            if agent_class == ConversationalAgent:
                return ConversationalAgent(
                    name=spec.name,
                    agent_type=spec.type,
                    system_prompt=self._generate_system_prompt(spec),
                    model=self.model
                )
            else:
                # For other agents, try with just config
                return agent_class(config=self.config)
    
    def _generate_system_prompt(self, spec: AgentSpecification) -> str:
        """
        Generate a system prompt based on agent specification
        
        Args:
            spec: Agent specification
            
        Returns:
            Generated system prompt
        """
        prompt = f"You are {spec.name}, a specialized AI agent."
        
        if spec.responsibilities:
            prompt += f" Your responsibilities include: {', '.join(spec.responsibilities)}."
        
        if spec.technologies:
            tech_names = [t.value if hasattr(t, 'value') else str(t) for t in spec.technologies]
            prompt += f" You are expert in: {', '.join(tech_names)}."
        
        if spec.tools:
            prompt += f" You have access to these tools: {', '.join(spec.tools)}."
        
        prompt += " Provide helpful, accurate, and detailed assistance within your domain of expertise."
        
        return prompt
    
    def register_agent_type(self, name: str, agent_class: Type[BaseAgent]):
        """
        Register a new agent type at runtime
        
        Args:
            name: Name for the agent type
            agent_class: The agent class
        """
        self.agent_registry[name] = agent_class
        logger.info(f"Registered new agent type: {name}")
    
    def register_agent_config(self, name: str, config: Dict[str, Any]):
        """
        Register a new agent configuration template
        
        Args:
            name: Template name
            config: Configuration template
        """
        self.agent_configs[name] = config
        logger.info(f"Registered new agent config: {name}")
    
    def get_available_types(self) -> List[str]:
        """Get list of available agent types"""
        return list(self.agent_registry.keys())
    
    def get_available_templates(self) -> List[str]:
        """Get list of available configuration templates"""
        return list(self.agent_configs.keys())
    
    async def create_agent_from_template(
        self,
        template_name: str,
        custom_name: Optional[str] = None,
        additional_config: Optional[Dict[str, Any]] = None
    ) -> BaseAgent:
        """
        Create an agent from a predefined template
        
        Args:
            template_name: Name of the template
            custom_name: Optional custom name for the agent
            additional_config: Additional configuration to merge
            
        Returns:
            Created agent instance
        """
        if template_name not in self.agent_configs:
            raise ValueError(f"Unknown template: {template_name}")
        
        template = self.agent_configs[template_name]
        base_class_name = template.get('base_class', 'conversational')
        
        # Create agent specification
        spec = AgentSpecification(
            name=custom_name or template_name.replace('_', ' ').title(),
            type=template.get('agent_type', AgentType.CODE)
        )
        
        # Merge configurations
        config = template.get('config', {}).copy()
        if additional_config:
            config.update(additional_config)
        
        spec.context_requirements = config
        
        # Create the agent
        return self.create_agent(spec)