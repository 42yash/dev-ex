"""
Redis cache client for AI Services
"""

import json
import redis.asyncio as redis
from typing import Optional, Any
import structlog

logger = structlog.get_logger()


class RedisCache:
    """Redis cache client for caching AI responses and session data"""
    
    # Default TTLs for different cache types (in seconds)
    DEFAULT_TTL = 3600  # 1 hour
    SESSION_TTL = 86400  # 24 hours
    AGENT_RESULT_TTL = 300  # 5 minutes
    USER_DATA_TTL = 7200  # 2 hours
    TEMP_TTL = 60  # 1 minute
    
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis: Optional[redis.Redis] = None
        
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
            
    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            logger.info("Redis connection closed")
            
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
            
    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache with expiration
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (defaults to DEFAULT_TTL)
        """
        try:
            ttl = ttl or self.DEFAULT_TTL
            await self.redis.set(
                key,
                json.dumps(value),
                ex=ttl
            )
            logger.debug(f"Cached {key} with TTL {ttl}s")
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            
    async def delete(self, key: str):
        """Delete key from cache"""
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
    
    async def set_session(self, session_id: str, data: Any):
        """Cache session data with appropriate TTL"""
        key = f"session:{session_id}"
        await self.set(key, data, ttl=self.SESSION_TTL)
    
    async def get_session(self, session_id: str) -> Optional[Any]:
        """Get session data from cache"""
        key = f"session:{session_id}"
        return await self.get(key)
    
    async def set_agent_result(self, agent_name: str, input_hash: str, result: Any):
        """Cache agent result with short TTL"""
        key = f"agent:{agent_name}:{input_hash}"
        await self.set(key, result, ttl=self.AGENT_RESULT_TTL)
    
    async def get_agent_result(self, agent_name: str, input_hash: str) -> Optional[Any]:
        """Get cached agent result"""
        key = f"agent:{agent_name}:{input_hash}"
        return await self.get(key)
    
    async def set_user_data(self, user_id: str, data_type: str, data: Any):
        """Cache user data with medium TTL"""
        key = f"user:{user_id}:{data_type}"
        await self.set(key, data, ttl=self.USER_DATA_TTL)
    
    async def get_user_data(self, user_id: str, data_type: str) -> Optional[Any]:
        """Get cached user data"""
        key = f"user:{user_id}:{data_type}"
        return await self.get(key)
    
    async def set_temp(self, key: str, value: Any):
        """Set temporary cache with very short TTL"""
        await self.set(f"temp:{key}", value, ttl=self.TEMP_TTL)
    
    async def expire(self, key: str, ttl: int):
        """Update TTL for existing key"""
        try:
            await self.redis.expire(key, ttl)
        except Exception as e:
            logger.error(f"Redis expire error: {e}")
    
    async def ttl_remaining(self, key: str) -> Optional[int]:
        """Get remaining TTL for a key"""
        try:
            ttl = await self.redis.ttl(key)
            return ttl if ttl >= 0 else None
        except Exception as e:
            logger.error(f"Redis TTL error: {e}")
            return None