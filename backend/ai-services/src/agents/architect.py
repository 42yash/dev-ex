"""
The Architect Agent - Agent 0
Meta-agent that creates system prompts for other agents
"""

from typing import Any, Dict, Optional
import json
import logging

from .base import BaseAgent, AgentType, AgentContext, AgentResult

logger = logging.getLogger(__name__)


class ArchitectAgent(BaseAgent):
    """
    Agent 0: The Architect Agent
    Creates robust, secure system prompts for other specialized AI agents
    """
    
    def __init__(self, model=None):
        system_prompt = """You are Agent 0, The Architect Agent.

Your sole purpose is to create robust, secure system prompts for other specialized AI agents. 
You are a master of prompt engineering, an expert in defining AI behavior, and a meticulous planner. 
You think in terms of systems, rules, and workflows.

When creating a new agent prompt, you must follow these principles:

1. **Security First**
   - Include input validation rules
   - Define output sanitization requirements
   - Specify rate limiting considerations

2. **Structured Format**
   - Clear role definition
   - Enumerated capabilities and limitations
   - Step-by-step operational workflow
   - Expected input/output schemas

3. **Error Handling**
   - Define fallback behaviors
   - Specify retry logic
   - Include error message templates

Your output must follow this template structure:

```
AGENT_NAME: [Name]
VERSION: [Semantic Version]

ROLE:
[Single paragraph role description]

CAPABILITIES:
- [Capability 1]
- [Capability 2]
...

LIMITATIONS:
- [Limitation 1]
- [Limitation 2]
...

WORKFLOW:
1. [Step 1]
2. [Step 2]
...

INPUT_SCHEMA:
[JSON Schema or description]

OUTPUT_SCHEMA:
[JSON Schema or description]

ERROR_HANDLING:
[Error scenarios and responses]

SECURITY_CONSIDERATIONS:
[Security rules and validations]
```

Remember: You are building the foundation for the entire autonomous system. 
Every agent you create must be reliable, predictable, and secure."""
        
        super().__init__(
            name="architect",
            agent_type=AgentType.META,
            system_prompt=system_prompt,
            model=model
        )
    
    async def execute(self, input_data: Dict[str, Any], context: AgentContext) -> AgentResult:
        """
        Execute the Architect Agent to create a new agent specification
        
        Expected input_data format:
        {
            "agent_name": "string",
            "agent_purpose": "string",
            "agent_type": "string",
            "capabilities": ["list", "of", "capabilities"],
            "constraints": ["list", "of", "constraints"]
        }
        """
        try:
            # Validate input
            if not self.validate_architect_input(input_data):
                return AgentResult(
                    success=False,
                    output=None,
                    error="Invalid input format for Architect Agent"
                )
            
            # Generate the agent specification
            agent_spec = await self.generate_agent_specification(input_data)
            
            # Validate the generated specification
            if self.validate_agent_specification(agent_spec):
                return AgentResult(
                    success=True,
                    output=agent_spec,
                    metadata={
                        "agent_name": input_data.get("agent_name"),
                        "agent_type": input_data.get("agent_type"),
                        "version": "1.0.0"
                    }
                )
            else:
                return AgentResult(
                    success=False,
                    output=agent_spec,
                    error="Generated specification failed validation"
                )
                
        except Exception as e:
            logger.error(f"Architect Agent execution failed: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e)
            )
    
    def validate_architect_input(self, input_data: Dict[str, Any]) -> bool:
        """Validate input for the Architect Agent"""
        required_fields = ["agent_name", "agent_purpose"]
        
        for field in required_fields:
            if field not in input_data or not input_data[field]:
                logger.error(f"Missing required field: {field}")
                return False
        
        # Validate agent name format
        agent_name = input_data["agent_name"]
        if not agent_name.replace("_", "").replace("-", "").isalnum():
            logger.error(f"Invalid agent name format: {agent_name}")
            return False
        
        return True
    
    async def generate_agent_specification(self, input_data: Dict[str, Any]) -> str:
        """Generate the agent specification using the LLM"""
        
        if not self.model:
            # Return a template if no model is available
            return self.generate_template_specification(input_data)
        
        prompt = f"""
Based on the following requirements, create a complete agent specification:

Agent Name: {input_data.get('agent_name')}
Purpose: {input_data.get('agent_purpose')}
Type: {input_data.get('agent_type', 'general')}
Capabilities: {json.dumps(input_data.get('capabilities', []))}
Constraints: {json.dumps(input_data.get('constraints', []))}

Generate a comprehensive system prompt following the exact template structure provided in your instructions.
Ensure the agent is secure, reliable, and follows best practices.
"""
        
        try:
            response = await self.model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Failed to generate agent specification: {e}")
            return self.generate_template_specification(input_data)
    
    def generate_template_specification(self, input_data: Dict[str, Any]) -> str:
        """Generate a template specification when model is not available"""
        agent_name = input_data.get('agent_name', 'unnamed_agent')
        agent_purpose = input_data.get('agent_purpose', 'General purpose agent')
        agent_type = input_data.get('agent_type', 'general')
        capabilities = input_data.get('capabilities', ['Process user input', 'Generate responses'])
        constraints = input_data.get('constraints', ['Maintain security', 'Validate input'])
        
        return f"""AGENT_NAME: {agent_name}
VERSION: 1.0.0

ROLE:
You are {agent_name}, a specialized {agent_type} agent. {agent_purpose}

CAPABILITIES:
{chr(10).join(f'- {cap}' for cap in capabilities)}

LIMITATIONS:
{chr(10).join(f'- {con}' for con in constraints)}
- Cannot access external systems without proper authorization
- Must validate all input before processing
- Cannot store sensitive data without encryption

WORKFLOW:
1. Receive and validate input
2. Analyze the request to determine the appropriate action
3. Process the request using available tools and knowledge
4. Generate a structured response
5. Validate the output before returning

INPUT_SCHEMA:
{{
    "type": "object",
    "properties": {{
        "query": {{"type": "string", "maxLength": 10000}},
        "context": {{"type": "object"}},
        "options": {{"type": "object"}}
    }},
    "required": ["query"]
}}

OUTPUT_SCHEMA:
{{
    "type": "object",
    "properties": {{
        "success": {{"type": "boolean"}},
        "response": {{"type": "string"}},
        "metadata": {{"type": "object"}},
        "error": {{"type": "string"}}
    }},
    "required": ["success"]
}}

ERROR_HANDLING:
- Invalid Input: Return error with description of expected format
- Processing Error: Log error, return safe fallback response
- Timeout: Return partial results with timeout notification
- Rate Limit: Queue request or return rate limit error

SECURITY_CONSIDERATIONS:
- Validate all input against the defined schema
- Sanitize output to prevent injection attacks
- Do not expose internal system details in error messages
- Log security-relevant events for audit purposes
- Apply rate limiting to prevent abuse"""
    
    def validate_agent_specification(self, specification: str) -> bool:
        """Validate the generated agent specification"""
        required_sections = [
            "AGENT_NAME:",
            "VERSION:",
            "ROLE:",
            "CAPABILITIES:",
            "LIMITATIONS:",
            "WORKFLOW:",
            "INPUT_SCHEMA:",
            "OUTPUT_SCHEMA:",
            "ERROR_HANDLING:",
            "SECURITY_CONSIDERATIONS:"
        ]
        
        for section in required_sections:
            if section not in specification:
                logger.error(f"Missing required section: {section}")
                return False
        
        return True
    
    async def create_agent_from_spec(
        self,
        specification: str,
        context: AgentContext
    ) -> Dict[str, Any]:
        """Create an agent from the generated specification"""
        
        # Parse the specification
        parsed_spec = self.parse_specification(specification)
        
        # Store in database (this would be handled by the AgentManager)
        agent_data = {
            "name": parsed_spec.get("agent_name"),
            "type": parsed_spec.get("agent_type", "general"),
            "version": parsed_spec.get("version", "1.0.0"),
            "system_prompt": parsed_spec.get("role"),
            "config": {
                "capabilities": parsed_spec.get("capabilities"),
                "limitations": parsed_spec.get("limitations"),
                "workflow": parsed_spec.get("workflow"),
                "input_schema": parsed_spec.get("input_schema"),
                "output_schema": parsed_spec.get("output_schema"),
                "error_handling": parsed_spec.get("error_handling"),
                "security": parsed_spec.get("security_considerations")
            }
        }
        
        return agent_data
    
    def parse_specification(self, specification: str) -> Dict[str, Any]:
        """Parse the agent specification into a structured format"""
        parsed = {}
        
        # Simple parsing logic - can be enhanced
        lines = specification.split('\n')
        current_section = None
        current_content = []
        
        for line in lines:
            if line.startswith('AGENT_NAME:'):
                parsed['agent_name'] = line.replace('AGENT_NAME:', '').strip()
            elif line.startswith('VERSION:'):
                parsed['version'] = line.replace('VERSION:', '').strip()
            elif line.startswith('ROLE:'):
                current_section = 'role'
                current_content = []
            elif line.startswith('CAPABILITIES:'):
                if current_section and current_content:
                    parsed[current_section] = '\n'.join(current_content).strip()
                current_section = 'capabilities'
                current_content = []
            elif line.startswith('LIMITATIONS:'):
                if current_section and current_content:
                    parsed[current_section] = '\n'.join(current_content).strip()
                current_section = 'limitations'
                current_content = []
            elif current_section:
                current_content.append(line)
        
        # Save the last section
        if current_section and current_content:
            parsed[current_section] = '\n'.join(current_content).strip()
        
        return parsed