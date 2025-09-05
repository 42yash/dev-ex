"""
Execution limiter for agents to prevent memory leaks and resource exhaustion
"""

import asyncio
import time
import tracemalloc
from typing import Dict, Optional, Any, Callable
from datetime import datetime, timedelta
import logging
from collections import deque
import gc

logger = logging.getLogger(__name__)


class ExecutionLimiter:
    """Limits agent execution resources and prevents memory leaks"""
    
    def __init__(
        self,
        max_execution_time: float = 30.0,  # Maximum execution time in seconds
        max_memory_mb: int = 512,  # Maximum memory usage in MB
        max_concurrent_executions: int = 10,  # Max concurrent executions
        history_size: int = 100,  # Max history entries to keep
        cleanup_interval: int = 300  # Cleanup interval in seconds
    ):
        self.max_execution_time = max_execution_time
        self.max_memory_mb = max_memory_mb
        self.max_concurrent_executions = max_concurrent_executions
        self.history_size = history_size
        self.cleanup_interval = cleanup_interval
        
        # Tracking structures
        self.execution_history: deque = deque(maxlen=history_size)
        self.active_executions: Dict[str, Dict[str, Any]] = {}
        self.semaphore = asyncio.Semaphore(max_concurrent_executions)
        self.last_cleanup = time.time()
        
        # Start memory tracking
        tracemalloc.start()
    
    async def execute_with_limits(
        self,
        execution_id: str,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """Execute a function with resource limits"""
        
        # Check if we need cleanup
        await self._periodic_cleanup()
        
        # Acquire semaphore for concurrency limiting
        async with self.semaphore:
            # Track execution start
            start_time = time.time()
            start_memory = self._get_memory_usage()
            
            self.active_executions[execution_id] = {
                "start_time": start_time,
                "start_memory": start_memory,
                "function": func.__name__
            }
            
            try:
                # Execute with timeout
                result = await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=self.max_execution_time
                )
                
                # Check memory usage
                current_memory = self._get_memory_usage()
                memory_increase = current_memory - start_memory
                
                if memory_increase > self.max_memory_mb:
                    logger.warning(
                        f"Execution {execution_id} exceeded memory limit: "
                        f"{memory_increase:.2f}MB > {self.max_memory_mb}MB"
                    )
                    # Force garbage collection
                    gc.collect()
                
                # Record successful execution
                self._record_execution(
                    execution_id,
                    success=True,
                    duration=time.time() - start_time,
                    memory_used=memory_increase
                )
                
                return result
                
            except asyncio.TimeoutError:
                logger.error(
                    f"Execution {execution_id} timed out after {self.max_execution_time}s"
                )
                self._record_execution(
                    execution_id,
                    success=False,
                    duration=self.max_execution_time,
                    error="Execution timeout"
                )
                raise TimeoutError(f"Execution exceeded {self.max_execution_time}s limit")
                
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Execution {execution_id} failed: {str(e)}")
                self._record_execution(
                    execution_id,
                    success=False,
                    duration=duration,
                    error=str(e)
                )
                raise
                
            finally:
                # Clean up execution tracking
                if execution_id in self.active_executions:
                    del self.active_executions[execution_id]
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        current, peak = tracemalloc.get_traced_memory()
        return current / 1024 / 1024  # Convert to MB
    
    def _record_execution(
        self,
        execution_id: str,
        success: bool,
        duration: float,
        memory_used: float = 0,
        error: Optional[str] = None
    ):
        """Record execution details in history"""
        self.execution_history.append({
            "execution_id": execution_id,
            "timestamp": datetime.utcnow().isoformat(),
            "success": success,
            "duration": duration,
            "memory_used": memory_used,
            "error": error
        })
    
    async def _periodic_cleanup(self):
        """Perform periodic cleanup of resources"""
        current_time = time.time()
        
        if current_time - self.last_cleanup > self.cleanup_interval:
            logger.info("Performing periodic cleanup")
            
            # Force garbage collection
            gc.collect()
            
            # Clear old execution data
            cutoff_time = current_time - 3600  # 1 hour ago
            self.active_executions = {
                eid: data for eid, data in self.active_executions.items()
                if data["start_time"] > cutoff_time
            }
            
            # Reset memory tracking if usage is high
            current_memory = self._get_memory_usage()
            if current_memory > self.max_memory_mb * 0.8:
                logger.warning(f"High memory usage detected: {current_memory:.2f}MB")
                tracemalloc.clear_traces()
                gc.collect()
            
            self.last_cleanup = current_time
    
    def get_stats(self) -> Dict[str, Any]:
        """Get execution statistics"""
        if not self.execution_history:
            return {
                "total_executions": 0,
                "success_rate": 0,
                "avg_duration": 0,
                "avg_memory": 0,
                "active_executions": len(self.active_executions)
            }
        
        total = len(self.execution_history)
        successful = sum(1 for e in self.execution_history if e["success"])
        avg_duration = sum(e["duration"] for e in self.execution_history) / total
        avg_memory = sum(e["memory_used"] for e in self.execution_history) / total
        
        return {
            "total_executions": total,
            "success_rate": successful / total * 100,
            "avg_duration": avg_duration,
            "avg_memory": avg_memory,
            "active_executions": len(self.active_executions),
            "current_memory": self._get_memory_usage()
        }
    
    def cleanup(self):
        """Clean up resources"""
        tracemalloc.stop()
        self.execution_history.clear()
        self.active_executions.clear()
        gc.collect()


class CircuitBreaker:
    """Circuit breaker pattern for agent execution"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
            
        except self.expected_exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        """Check if we should attempt to reset the circuit"""
        return (
            self.last_failure_time and
            time.time() - self.last_failure_time >= self.recovery_timeout
        )
    
    def _on_success(self):
        """Handle successful execution"""
        self.failure_count = 0
        self.state = "closed"
    
    def _on_failure(self):
        """Handle failed execution"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")