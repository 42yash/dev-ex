"""
Database connection manager for AI Services
"""

import asyncio
import asyncpg
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import json
from datetime import datetime
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
    
    async def fetchval(self, query: str, *args):
        """Fetch single value from database"""
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)
    
    async def query(self, query: str, *args) -> List[Dict[str, Any]]:
        """Execute query and return results as list of dicts"""
        rows = await self.fetch(query, *args)
        return [dict(row) for row in rows]
    
    @asynccontextmanager
    async def transaction(self):
        """Context manager for database transactions"""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a database connection from the pool"""
        async with self.pool.acquire() as conn:
            yield conn
    
    async def execute_many(self, query: str, args_list: List[tuple]):
        """Execute multiple queries in a single transaction"""
        async with self.transaction() as conn:
            await conn.executemany(query, args_list)
    
    async def create_tables(self):
        """Create necessary tables if they don't exist"""
        queries = [
            # Agent executions table
            """
            CREATE TABLE IF NOT EXISTS agent_executions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_id UUID REFERENCES agents(id),
                session_id VARCHAR(255),
                input TEXT,
                output TEXT,
                status VARCHAR(50),
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                error TEXT,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            
            # Create indexes
            """
            CREATE INDEX IF NOT EXISTS idx_agent_executions_session 
            ON agent_executions(session_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_agent_executions_agent 
            ON agent_executions(agent_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_agent_executions_status 
            ON agent_executions(status)
            """
        ]
        
        for query in queries:
            try:
                await self.execute(query)
            except Exception as e:
                logger.warning(f"Table/index creation warning: {e}")
    
    async def health_check(self) -> bool:
        """Check database connection health"""
        try:
            result = await self.fetchval("SELECT 1")
            return result == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    async def get_pool_stats(self) -> Dict[str, Any]:
        """Get connection pool statistics"""
        if not self.pool:
            return {}
        
        return {
            "size": self.pool.get_size(),
            "free_size": self.pool.get_free_size(),
            "min_size": self.pool.get_min_size(),
            "max_size": self.pool.get_max_size()
        }