"""
Redis cache client for AI Services
"""

import json
import aioredis
from typing import Optional, Any
import structlog

logger = structlog.get_logger()


class RedisCache:
    """Redis cache client for caching AI responses and session data"""
    
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = await aioredis.from_url(
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
            
    async def set(self, key: str, value: Any, expire: int = 3600):
        """Set value in cache with expiration"""
        try:
            await self.redis.set(
                key,
                json.dumps(value),
                ex=expire
            )
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            
    async def delete(self, key: str):
        """Delete key from cache"""
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")