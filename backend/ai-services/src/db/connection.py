"""
Database connection manager for AI Services
"""

import asyncio
import asyncpg
from typing import Optional
import structlog

logger = structlog.get_logger()


class DatabaseManager:
    """Manages PostgreSQL database connections with pgvector support"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None
        
    async def initialize(self):
        """Initialize database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("Database connection pool created")
            
            # Test connection and setup pgvector if needed
            async with self.pool.acquire() as conn:
                await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
                logger.info("pgvector extension ready")
                
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
            
    async def close(self):
        """Close database connections"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
            
    async def execute(self, query: str, *args):
        """Execute a database query"""
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)
            
    async def fetch(self, query: str, *args):
        """Fetch results from database"""
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)
            
    async def fetchrow(self, query: str, *args):
        """Fetch single row from database"""
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)