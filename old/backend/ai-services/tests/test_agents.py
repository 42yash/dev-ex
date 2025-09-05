"""
Test suite for AI agents
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from src.agents.base import (
    BaseAgent, ConversationalAgent, AgentContext,
    AgentResult, AgentStatus, AgentType
)
from src.agents.manager import AgentManager
from src.cache.redis_client import RedisCache


class TestConversationalAgent:
    """Test conversational agent functionality"""
    
    @pytest.fixture
    def agent(self):
        """Create a test agent"""
        return ConversationalAgent(
            name="test_agent",
            agent_type=AgentType.CREATIVE,
            system_prompt="You are a test agent",
            model=None,
            config={"max_history_size": 10, "max_conversation_history": 5}
        )
    
    @pytest.fixture
    def context(self):
        """Create test context"""
        return AgentContext(
            session_id="test_session",
            user_id="test_user",
            execution_id="test_exec"
        )
    
    def test_agent_initialization(self, agent):
        """Test agent is properly initialized"""
        assert agent.name == "test_agent"
        assert agent.agent_type == AgentType.CREATIVE
        assert agent.status == AgentStatus.IDLE
        assert len(agent.execution_history) == 0
        assert agent.max_history_size == 10
    
    def test_execution_history_limit(self, agent):
        """Test execution history is bounded"""
        # Add more than max_history_size results
        for i in range(15):
            result = AgentResult(
                success=True,
                output=f"Result {i}",
                execution_time=1.0
            )
            agent.add_to_history(result)
        
        # Should only keep max_history_size items
        assert len(agent.execution_history) == 10
        # Should keep most recent items
        assert agent.execution_history[-1].output == "Result 14"
        assert agent.execution_history[0].output == "Result 5"
    
    def test_conversation_history_limit(self, agent):
        """Test conversation history is bounded"""
        # Add more than max_conversation_history messages
        for i in range(10):
            agent.add_to_conversation({
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"Message {i}"
            })
        
        # Should keep first message and recent messages
        assert len(agent.conversation_history) == 5
        # First message preserved for context
        assert agent.conversation_history[0]["content"] == "Message 0"
        # Recent messages preserved
        assert agent.conversation_history[-1]["content"] == "Message 9"
    
    def test_clear_history(self, agent):
        """Test clearing histories"""
        # Add some history
        agent.add_to_history(AgentResult(success=True, output="test"))
        agent.add_to_conversation({"role": "user", "content": "test"})
        
        # Clear histories
        agent.clear_history()
        agent.clear_conversation()
        
        assert len(agent.execution_history) == 0
        assert len(agent.conversation_history) == 0
    
    @pytest.mark.asyncio
    async def test_execute_without_model(self, agent, context):
        """Test execution without a model returns error"""
        result = await agent.execute("test input", context)
        
        assert result.success == False
        assert result.error is not None


class TestAgentManager:
    """Test agent manager functionality"""
    
    @pytest.fixture
    async def manager(self):
        """Create test agent manager"""
        config = Mock()
        config.gemini.api_key = None
        config.gemini.model = "test-model"
        config.gemini.temperature = 0.7
        config.gemini.max_tokens = 1000
        
        db_manager = AsyncMock()
        cache = AsyncMock(spec=RedisCache)
        
        manager = AgentManager(config, db_manager, cache)
        await manager.initialize()
        return manager
    
    @pytest.mark.asyncio
    async def test_manager_initialization(self, manager):
        """Test manager initializes with core agents"""
        assert len(manager.agents) >= 4  # architect, idea_generator, technical_writer, chat
        assert "architect" in manager.agents
        assert "idea_generator" in manager.agents
        assert "technical_writer" in manager.agents
        assert "chat" in manager.agents
    
    @pytest.mark.asyncio
    async def test_execute_agent_with_cache_hit(self, manager):
        """Test agent execution with cache hit"""
        context = AgentContext(
            session_id="test_session",
            user_id="test_user"
        )
        
        # Mock cache hit
        cached_result = {
            "success": True,
            "output": "Cached response",
            "metadata": {}
        }
        manager.cache.get_agent_result.return_value = cached_result
        
        result = await manager.execute_agent("chat", "test input", context)
        
        assert result.success == True
        assert result.output == "Cached response"
        manager.cache.get_agent_result.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_nonexistent_agent(self, manager):
        """Test execution of non-existent agent"""
        context = AgentContext(
            session_id="test_session",
            user_id="test_user"
        )
        
        result = await manager.execute_agent("nonexistent", "test", context)
        
        assert result.success == False
        assert "not found" in result.error


class TestRedisCache:
    """Test Redis cache functionality"""
    
    @pytest.fixture
    def cache(self):
        """Create test cache instance"""
        return RedisCache("redis://localhost:6379")
    
    def test_cache_ttl_constants(self, cache):
        """Test TTL constants are properly defined"""
        assert cache.DEFAULT_TTL == 3600
        assert cache.SESSION_TTL == 86400
        assert cache.AGENT_RESULT_TTL == 300
        assert cache.USER_DATA_TTL == 7200
        assert cache.TEMP_TTL == 60
    
    @pytest.mark.asyncio
    async def test_cache_key_formats(self, cache):
        """Test cache key formatting"""
        cache.redis = AsyncMock()
        
        # Test session cache
        await cache.set_session("session123", {"data": "test"})
        cache.redis.set.assert_called_with(
            "session:session123",
            '{"data": "test"}',
            ex=86400
        )
        
        # Test agent result cache
        await cache.set_agent_result("agent1", "hash123", {"result": "test"})
        cache.redis.set.assert_called_with(
            "agent:agent1:hash123",
            '{"result": "test"}',
            ex=300
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])