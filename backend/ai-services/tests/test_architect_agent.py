"""
Test suite for the Architect Agent
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
import json

from src.agents.architect import ArchitectAgent
from src.agents.base import AgentContext, AgentResult, AgentType


class TestArchitectAgent:
    """Test the Architect Agent (Agent 0)"""
    
    @pytest.fixture
    def mock_model(self):
        """Create mock Gemini model"""
        model = Mock()
        model.generate_content_async = AsyncMock()
        return model
    
    @pytest.fixture
    def agent(self, mock_model):
        """Create test architect agent"""
        return ArchitectAgent(model=mock_model)
    
    @pytest.fixture
    def context(self):
        """Create test context"""
        return AgentContext(
            session_id="test_session",
            user_id="test_user",
            execution_id="test_exec"
        )
    
    def test_agent_properties(self, agent):
        """Test agent is properly configured"""
        assert agent.name == "architect"
        assert agent.agent_type == AgentType.META
        assert "Architect Agent" in agent.system_prompt
        assert "security" in agent.system_prompt.lower()
    
    @pytest.mark.asyncio
    async def test_generate_agent_specification(self, agent, context, mock_model):
        """Test generating agent specification"""
        # Mock model response
        mock_response = Mock()
        mock_response.text = json.dumps({
            "agent_name": "TestAgent",
            "agent_type": "CREATIVE",
            "system_prompt": "You are a test agent",
            "capabilities": ["test", "validate"],
            "limitations": ["testing only"],
            "workflow": ["step1", "step2"],
            "security_requirements": ["input validation"],
            "error_handling": {"timeout": 30}
        })
        mock_model.generate_content_async.return_value = mock_response
        
        # Execute agent
        input_data = {
            "agent_purpose": "Testing agent generation",
            "target_functionality": "Unit testing"
        }
        
        result = await agent.execute(input_data, context)
        
        # Verify result
        assert result.success == True
        assert result.output is not None
        assert "agent_name" in result.output
        assert result.output["agent_type"] == "CREATIVE"
        
        # Verify model was called
        mock_model.generate_content_async.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_validate_generated_specification(self, agent):
        """Test specification validation"""
        valid_spec = {
            "agent_name": "ValidAgent",
            "agent_type": "CREATIVE",
            "system_prompt": "Valid prompt",
            "capabilities": ["cap1"],
            "limitations": ["lim1"],
            "workflow": ["step1"],
            "security_requirements": ["req1"],
            "error_handling": {}
        }
        
        # Should validate successfully
        is_valid = agent.validate_specification(valid_spec)
        assert is_valid == True
        
        # Test invalid specifications
        invalid_specs = [
            {},  # Empty
            {"agent_name": "NoType"},  # Missing agent_type
            {"agent_type": "INVALID"},  # Invalid type
            {  # Missing required fields
                "agent_name": "Incomplete",
                "agent_type": "CREATIVE"
            }
        ]
        
        for spec in invalid_specs:
            is_valid = agent.validate_specification(spec)
            assert is_valid == False
    
    @pytest.mark.asyncio
    async def test_security_requirements_included(self, agent, context, mock_model):
        """Test that security requirements are always included"""
        mock_response = Mock()
        mock_response.text = json.dumps({
            "agent_name": "SecureAgent",
            "agent_type": "CREATIVE",
            "system_prompt": "Secure agent",
            "capabilities": [],
            "limitations": [],
            "workflow": [],
            "security_requirements": [
                "Input validation",
                "Output sanitization",
                "Rate limiting"
            ],
            "error_handling": {}
        })
        mock_model.generate_content_async.return_value = mock_response
        
        result = await agent.execute({"purpose": "test"}, context)
        
        assert result.success == True
        assert "security_requirements" in result.output
        assert len(result.output["security_requirements"]) > 0
    
    @pytest.mark.asyncio
    async def test_error_handling(self, agent, context, mock_model):
        """Test error handling in agent execution"""
        # Simulate model error
        mock_model.generate_content_async.side_effect = Exception("Model error")
        
        result = await agent.execute({"purpose": "test"}, context)
        
        assert result.success == False
        assert result.error is not None
        assert "Model error" in result.error
    
    @pytest.mark.asyncio
    async def test_agent_versioning(self, agent, context, mock_model):
        """Test agent specification includes version"""
        mock_response = Mock()
        mock_response.text = json.dumps({
            "agent_name": "VersionedAgent",
            "agent_type": "CREATIVE",
            "version": "1.0.0",
            "system_prompt": "Versioned agent",
            "capabilities": [],
            "limitations": [],
            "workflow": [],
            "security_requirements": [],
            "error_handling": {}
        })
        mock_model.generate_content_async.return_value = mock_response
        
        result = await agent.execute({"purpose": "test"}, context)
        
        assert result.success == True
        assert "version" in result.output
    
    def test_specification_template(self, agent):
        """Test that agent has proper specification template"""
        template = agent.get_specification_template()
        
        required_fields = [
            "agent_name",
            "agent_type",
            "system_prompt",
            "capabilities",
            "limitations",
            "workflow",
            "security_requirements",
            "error_handling"
        ]
        
        for field in required_fields:
            assert field in template
    
    @pytest.mark.asyncio
    async def test_meta_agent_cannot_create_meta_agents(self, agent, context, mock_model):
        """Test that architect cannot create other meta agents"""
        mock_response = Mock()
        mock_response.text = json.dumps({
            "agent_name": "AnotherMeta",
            "agent_type": "META",  # Should be rejected
            "system_prompt": "Another meta agent",
            "capabilities": [],
            "limitations": [],
            "workflow": [],
            "security_requirements": [],
            "error_handling": {}
        })
        mock_model.generate_content_async.return_value = mock_response
        
        result = await agent.execute({"purpose": "create meta agent"}, context)
        
        # Should either fail or change the type
        if result.success:
            assert result.output["agent_type"] != "META"
        else:
            assert "cannot create meta agents" in result.error.lower()