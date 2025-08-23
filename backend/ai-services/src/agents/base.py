"""
Base Agent Classes for Dev-Ex Platform
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable
from enum import Enum
import asyncio
import json
import logging
from datetime import datetime
import uuid

import google.generativeai as genai
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AgentStatus(Enum):
    """Agent execution status"""
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentType(Enum):
    """Types of agents in the system"""
    META = "meta"  # Agent 0: Creates other agents
    CREATIVE = "creative"  # Idea generation
    DOCUMENTATION = "documentation"  # Technical writing
    CODE = "code"  # Code generation
    ANALYSIS = "analysis"  # Code/doc analysis
    WORKFLOW = "workflow"  # Workflow orchestration


@dataclass
class AgentContext:
    """Context passed between agents"""
    session_id: str
    user_id: str
    execution_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    previous_agents: List[str] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Result from agent execution"""
    success: bool
    output: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    tokens_used: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class Tool(ABC):
    """Base class for agent tools"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """Execute the tool with given parameters"""
        pass


class BaseAgent(ABC):
    """Base class for all agents"""
    
    def __init__(
        self,
        name: str,
        agent_type: AgentType,
        system_prompt: str,
        model: Optional[genai.GenerativeModel] = None,
        tools: Optional[List[Tool]] = None,
        config: Optional[Dict[str, Any]] = None
    ):
        self.name = name
        self.agent_type = agent_type
        self.system_prompt = system_prompt
        self.model = model
        self.tools = tools or []
        self.config = config or {}
        self.status = AgentStatus.IDLE
        self.execution_history: List[AgentResult] = []
        
        # Create tools mapping
        self.tool_map = {tool.name: tool for tool in self.tools}
    
    @abstractmethod
    async def execute(self, input_data: Any, context: AgentContext) -> AgentResult:
        """Execute the agent's main logic"""
        pass
    
    async def reason(self, input_data: Any, context: AgentContext) -> Dict[str, Any]:
        """Reasoning phase - determine what action to take"""
        if not self.model:
            return {"action": "direct_response", "reasoning": "No model configured"}
        
        prompt = self._build_reasoning_prompt(input_data, context)
        
        try:
            response = await self.model.generate_content_async(prompt)
            return self._parse_reasoning_response(response.text)
        except Exception as e:
            logger.error(f"Reasoning failed for {self.name}: {e}")
            return {"action": "error", "reasoning": str(e)}
    
    async def act(self, action: Dict[str, Any], context: AgentContext) -> Any:
        """Action phase - execute the determined action"""
        action_type = action.get("action", "direct_response")
        
        if action_type == "tool_use":
            tool_name = action.get("tool")
            tool_params = action.get("params", {})
            return await self.use_tool(tool_name, **tool_params)
        
        elif action_type == "delegate":
            agent_name = action.get("agent")
            return await self.delegate_to_agent(agent_name, action.get("input"), context)
        
        else:
            return action.get("response", "No action taken")
    
    async def use_tool(self, tool_name: str, **kwargs) -> Any:
        """Use a specific tool"""
        tool = self.tool_map.get(tool_name)
        if not tool:
            raise ValueError(f"Tool '{tool_name}' not found")
        
        logger.info(f"Agent {self.name} using tool: {tool_name}")
        return await tool.execute(**kwargs)
    
    async def delegate_to_agent(self, agent_name: str, input_data: Any, context: AgentContext) -> Any:
        """Delegate to another agent (to be implemented by AgentManager)"""
        logger.info(f"Agent {self.name} delegating to: {agent_name}")
        # This will be handled by the AgentManager
        return {"delegated_to": agent_name, "input": input_data}
    
    def _build_reasoning_prompt(self, input_data: Any, context: AgentContext) -> str:
        """Build the reasoning prompt"""
        tools_description = "\n".join([
            f"- {tool.name}: {tool.description}"
            for tool in self.tools
        ])
        
        return f"""
{self.system_prompt}

Current Context:
- Session ID: {context.session_id}
- Previous Agents: {', '.join(context.previous_agents) if context.previous_agents else 'None'}
- Variables: {json.dumps(context.variables, indent=2)}

Available Tools:
{tools_description if tools_description else 'No tools available'}

Input:
{input_data}

Based on the input and context, determine the best action to take.
Respond in the following JSON format:
{{
    "action": "tool_use|delegate|direct_response",
    "reasoning": "Your reasoning for this action",
    "tool": "tool_name if action is tool_use",
    "params": {{}} // tool parameters if action is tool_use,
    "agent": "agent_name if action is delegate",
    "response": "direct response if action is direct_response"
}}
"""
    
    def _parse_reasoning_response(self, response: str) -> Dict[str, Any]:
        """Parse the reasoning response"""
        try:
            # Try to extract JSON from the response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback to direct response
                return {
                    "action": "direct_response",
                    "reasoning": "Could not parse structured response",
                    "response": response
                }
        except json.JSONDecodeError:
            return {
                "action": "direct_response",
                "reasoning": "Failed to parse JSON response",
                "response": response
            }
    
    async def validate_input(self, input_data: Any) -> bool:
        """Validate input data before processing"""
        return True  # Override in subclasses for specific validation
    
    async def preprocess(self, input_data: Any, context: AgentContext) -> Any:
        """Preprocess input data"""
        return input_data  # Override in subclasses
    
    async def postprocess(self, output: Any, context: AgentContext) -> Any:
        """Postprocess output data"""
        return output  # Override in subclasses


class ConversationalAgent(BaseAgent):
    """Agent specialized for conversational interactions"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.conversation_history: List[Dict[str, str]] = []
    
    async def execute(self, input_data: str, context: AgentContext) -> AgentResult:
        """Execute conversational logic"""
        start_time = datetime.utcnow()
        
        try:
            # Add to conversation history
            self.conversation_history.append({
                "role": "user",
                "content": input_data
            })
            
            # Reason about the input
            reasoning = await self.reason(input_data, context)
            
            # Take action based on reasoning
            action_result = await self.act(reasoning, context)
            
            # Generate final response
            response = await self.generate_response(input_data, action_result, context)
            
            # Add to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return AgentResult(
                success=True,
                output=response,
                execution_time=execution_time,
                metadata={"reasoning": reasoning}
            )
            
        except Exception as e:
            logger.error(f"Agent {self.name} execution failed: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds()
            )
    
    async def generate_response(self, input_data: str, action_result: Any, context: AgentContext) -> str:
        """Generate the final response"""
        if isinstance(action_result, str):
            return action_result
        
        if not self.model:
            return "I'm unable to generate a response at this time."
        
        prompt = f"""
{self.system_prompt}

Conversation History:
{self._format_conversation_history()}

User Input: {input_data}

Action Result: {json.dumps(action_result) if not isinstance(action_result, str) else action_result}

Generate a helpful and informative response to the user based on the conversation history and action result.
"""
        
        try:
            response = await self.model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Failed to generate response: {e}")
            return "I encountered an error while generating a response. Please try again."
    
    def _format_conversation_history(self, max_messages: int = 10) -> str:
        """Format conversation history for the prompt"""
        recent_messages = self.conversation_history[-max_messages:]
        return "\n".join([
            f"{msg['role'].capitalize()}: {msg['content']}"
            for msg in recent_messages
        ])


class WorkflowAgent(BaseAgent):
    """Agent that orchestrates workflows of other agents"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.workflow_steps: List[Dict[str, Any]] = []
    
    async def execute(self, input_data: Any, context: AgentContext) -> AgentResult:
        """Execute workflow logic"""
        start_time = datetime.utcnow()
        
        try:
            # Define workflow steps based on input
            self.workflow_steps = await self.plan_workflow(input_data, context)
            
            # Execute workflow steps
            results = []
            for step in self.workflow_steps:
                step_result = await self.execute_step(step, context)
                results.append(step_result)
                
                # Check if step requires user approval
                if step.get("requires_approval"):
                    # This would integrate with the approval system
                    pass
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return AgentResult(
                success=True,
                output=results,
                execution_time=execution_time,
                metadata={"workflow_steps": self.workflow_steps}
            )
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds()
            )
    
    async def plan_workflow(self, input_data: Any, context: AgentContext) -> List[Dict[str, Any]]:
        """Plan the workflow steps"""
        # Override in subclasses to define specific workflow logic
        return []
    
    async def execute_step(self, step: Dict[str, Any], context: AgentContext) -> Any:
        """Execute a single workflow step"""
        step_type = step.get("type")
        
        if step_type == "agent":
            return await self.delegate_to_agent(
                step.get("agent"),
                step.get("input"),
                context
            )
        elif step_type == "tool":
            return await self.use_tool(
                step.get("tool"),
                **step.get("params", {})
            )
        else:
            return step.get("output", "Unknown step type")