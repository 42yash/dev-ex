"""
Tests for the execution limiter module
"""

import asyncio
import pytest
import time
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from src.agents.execution_limiter import ExecutionLimiter, CircuitBreaker


class TestExecutionLimiter:
    """Test cases for ExecutionLimiter"""
    
    @pytest.fixture
    def limiter(self):
        """Create a test execution limiter"""
        return ExecutionLimiter(
            max_execution_time=1.0,  # 1 second for testing
            max_memory_mb=100,
            max_concurrent_executions=2,
            history_size=10
        )
    
    @pytest.mark.asyncio
    async def test_successful_execution(self, limiter):
        """Test successful function execution within limits"""
        async def test_func():
            await asyncio.sleep(0.1)
            return "success"
        
        result = await limiter.execute_with_limits(
            "test_1",
            test_func
        )
        
        assert result == "success"
        assert len(limiter.execution_history) == 1
        assert limiter.execution_history[0]["success"] is True
    
    @pytest.mark.asyncio
    async def test_timeout_execution(self, limiter):
        """Test function execution that times out"""
        async def slow_func():
            await asyncio.sleep(2.0)  # Longer than timeout
            return "should not reach"
        
        with pytest.raises(TimeoutError) as exc_info:
            await limiter.execute_with_limits(
                "test_timeout",
                slow_func
            )
        
        assert "Execution exceeded 1.0s limit" in str(exc_info.value)
        assert len(limiter.execution_history) == 1
        assert limiter.execution_history[0]["success"] is False
    
    @pytest.mark.asyncio
    async def test_concurrent_execution_limit(self, limiter):
        """Test concurrent execution limiting"""
        execution_order = []
        
        async def tracked_func(id):
            execution_order.append(f"start_{id}")
            await asyncio.sleep(0.2)
            execution_order.append(f"end_{id}")
            return id
        
        # Start 3 executions (but limit is 2)
        tasks = [
            asyncio.create_task(
                limiter.execute_with_limits(f"concurrent_{i}", tracked_func, i)
            )
            for i in range(3)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # All should complete eventually
        assert sorted(results) == [0, 1, 2]
        
        # Check that max 2 were running concurrently
        # The third should start after one of the first two ends
        assert execution_order.index("start_2") > min(
            execution_order.index("end_0"),
            execution_order.index("end_1")
        )
    
    @pytest.mark.asyncio
    async def test_execution_with_error(self, limiter):
        """Test function execution that raises an error"""
        async def error_func():
            raise ValueError("Test error")
        
        with pytest.raises(ValueError) as exc_info:
            await limiter.execute_with_limits(
                "test_error",
                error_func
            )
        
        assert str(exc_info.value) == "Test error"
        assert len(limiter.execution_history) == 1
        assert limiter.execution_history[0]["success"] is False
        assert limiter.execution_history[0]["error"] == "Test error"
    
    @pytest.mark.asyncio
    async def test_memory_tracking(self, limiter):
        """Test memory usage tracking"""
        async def memory_func():
            # Allocate some memory
            data = [0] * 1000000
            return len(data)
        
        with patch.object(limiter, '_get_memory_usage') as mock_memory:
            # Simulate memory usage
            mock_memory.side_effect = [50.0, 80.0]  # Start and end memory
            
            result = await limiter.execute_with_limits(
                "test_memory",
                memory_func
            )
            
            assert result == 1000000
            history = limiter.execution_history[0]
            assert history["memory_used"] == 30.0  # 80 - 50
    
    @pytest.mark.asyncio
    async def test_history_size_limit(self, limiter):
        """Test that execution history respects size limit"""
        async def simple_func(i):
            return i
        
        # Execute more than history size
        for i in range(15):
            await limiter.execute_with_limits(
                f"test_{i}",
                simple_func,
                i
            )
        
        # History should be capped at max size (10)
        assert len(limiter.execution_history) == 10
        
        # Should contain the most recent executions
        assert limiter.execution_history[-1]["execution_id"] == "test_14"
    
    def test_get_stats_empty(self, limiter):
        """Test statistics when no executions have occurred"""
        stats = limiter.get_stats()
        
        assert stats["total_executions"] == 0
        assert stats["success_rate"] == 0
        assert stats["avg_duration"] == 0
        assert stats["avg_memory"] == 0
        assert stats["active_executions"] == 0
    
    @pytest.mark.asyncio
    async def test_get_stats_with_data(self, limiter):
        """Test statistics with execution data"""
        async def test_func(should_fail=False):
            if should_fail:
                raise Exception("Failed")
            await asyncio.sleep(0.1)
            return "success"
        
        # Execute some successful and failed operations
        await limiter.execute_with_limits("test_1", test_func, False)
        await limiter.execute_with_limits("test_2", test_func, False)
        
        try:
            await limiter.execute_with_limits("test_3", test_func, True)
        except Exception:
            pass
        
        stats = limiter.get_stats()
        
        assert stats["total_executions"] == 3
        assert stats["success_rate"] == pytest.approx(66.67, rel=0.1)
        assert stats["avg_duration"] > 0
        assert stats["active_executions"] == 0
    
    @pytest.mark.asyncio
    async def test_periodic_cleanup(self, limiter):
        """Test periodic cleanup mechanism"""
        limiter.cleanup_interval = 0.1  # Short interval for testing
        limiter.last_cleanup = time.time() - 1  # Force cleanup
        
        # Add some active executions
        limiter.active_executions["old"] = {
            "start_time": time.time() - 7200,  # 2 hours ago
            "start_memory": 50,
            "function": "old_func"
        }
        limiter.active_executions["recent"] = {
            "start_time": time.time() - 10,  # 10 seconds ago
            "start_memory": 50,
            "function": "recent_func"
        }
        
        async def test_func():
            return "success"
        
        await limiter.execute_with_limits("test", test_func)
        
        # Old execution should be cleaned up
        assert "old" not in limiter.active_executions
        assert "recent" in limiter.active_executions
    
    def test_cleanup(self, limiter):
        """Test resource cleanup"""
        # Add some data
        limiter.execution_history.append({"test": "data"})
        limiter.active_executions["test"] = {"data": "test"}
        
        limiter.cleanup()
        
        assert len(limiter.execution_history) == 0
        assert len(limiter.active_executions) == 0


class TestCircuitBreaker:
    """Test cases for CircuitBreaker"""
    
    @pytest.fixture
    def circuit_breaker(self):
        """Create a test circuit breaker"""
        return CircuitBreaker(
            failure_threshold=3,
            recovery_timeout=1,
            expected_exception=ValueError
        )
    
    @pytest.mark.asyncio
    async def test_successful_calls(self, circuit_breaker):
        """Test circuit breaker with successful calls"""
        async def success_func():
            return "success"
        
        # Multiple successful calls
        for _ in range(5):
            result = await circuit_breaker.call(success_func)
            assert result == "success"
        
        assert circuit_breaker.state == "closed"
        assert circuit_breaker.failure_count == 0
    
    @pytest.mark.asyncio
    async def test_circuit_opens_after_failures(self, circuit_breaker):
        """Test circuit breaker opens after threshold failures"""
        async def failing_func():
            raise ValueError("Expected failure")
        
        # Fail up to threshold
        for i in range(3):
            with pytest.raises(ValueError):
                await circuit_breaker.call(failing_func)
        
        assert circuit_breaker.state == "open"
        assert circuit_breaker.failure_count == 3
        
        # Circuit is open, should reject calls
        with pytest.raises(Exception) as exc_info:
            await circuit_breaker.call(failing_func)
        assert "Circuit breaker is open" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_circuit_half_open_after_timeout(self, circuit_breaker):
        """Test circuit breaker enters half-open state after timeout"""
        async def failing_func():
            raise ValueError("Expected failure")
        
        async def success_func():
            return "success"
        
        # Open the circuit
        for _ in range(3):
            with pytest.raises(ValueError):
                await circuit_breaker.call(failing_func)
        
        assert circuit_breaker.state == "open"
        
        # Wait for recovery timeout
        await asyncio.sleep(1.1)
        
        # Should enter half-open and allow one call
        result = await circuit_breaker.call(success_func)
        assert result == "success"
        assert circuit_breaker.state == "closed"
        assert circuit_breaker.failure_count == 0
    
    @pytest.mark.asyncio
    async def test_circuit_reopens_on_half_open_failure(self, circuit_breaker):
        """Test circuit reopens if call fails in half-open state"""
        async def failing_func():
            raise ValueError("Expected failure")
        
        # Open the circuit
        for _ in range(3):
            with pytest.raises(ValueError):
                await circuit_breaker.call(failing_func)
        
        # Wait for recovery timeout
        await asyncio.sleep(1.1)
        
        # Fail in half-open state
        with pytest.raises(ValueError):
            await circuit_breaker.call(failing_func)
        
        # Should be open again
        assert circuit_breaker.state == "open"
        assert circuit_breaker.failure_count == 4
    
    @pytest.mark.asyncio
    async def test_unexpected_exception_not_counted(self, circuit_breaker):
        """Test that unexpected exceptions don't trigger circuit breaker"""
        async def unexpected_error():
            raise RuntimeError("Unexpected error")
        
        # This should raise but not count as failure
        with pytest.raises(RuntimeError):
            await circuit_breaker.call(unexpected_error)
        
        assert circuit_breaker.failure_count == 0
        assert circuit_breaker.state == "closed"
    
    @pytest.mark.asyncio
    async def test_reset_after_success(self, circuit_breaker):
        """Test failure count resets after successful call"""
        async def sometimes_fails(should_fail):
            if should_fail:
                raise ValueError("Expected failure")
            return "success"
        
        # Some failures but not enough to open
        for _ in range(2):
            with pytest.raises(ValueError):
                await circuit_breaker.call(sometimes_fails, True)
        
        assert circuit_breaker.failure_count == 2
        
        # Successful call should reset
        result = await circuit_breaker.call(sometimes_fails, False)
        assert result == "success"
        assert circuit_breaker.failure_count == 0
        assert circuit_breaker.state == "closed"