#!/usr/bin/env python3
"""
Dev-Ex AI Services - Main gRPC Server
"""

import asyncio
import logging
import os
import signal
import sys
from concurrent import futures
from typing import Optional

import grpc
from dotenv import load_dotenv
import structlog

from src.config import Config
from src.services.grpc_server import AIServicer
from src.db.connection import DatabaseManager
from src.cache.redis_client import RedisCache
from src.agents.manager import AgentManager

# Load environment variables
load_dotenv()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class AIServer:
    """Main AI Services gRPC Server"""
    
    def __init__(self, config: Config):
        self.config = config
        self.server: Optional[grpc.Server] = None
        self.db_manager: Optional[DatabaseManager] = None
        self.redis_cache: Optional[RedisCache] = None
        self.agent_manager: Optional[AgentManager] = None
        
    async def initialize(self):
        """Initialize all services and connections"""
        logger.info("Initializing AI Services...")
        
        # Initialize database
        self.db_manager = DatabaseManager(self.config.database.url)
        await self.db_manager.initialize()
        logger.info("Database initialized")
        
        # Initialize Redis cache
        self.redis_cache = RedisCache(self.config.redis.url)
        await self.redis_cache.connect()
        logger.info("Redis cache initialized")
        
        # Initialize agent manager
        self.agent_manager = AgentManager(
            config=self.config,
            db_manager=self.db_manager,
            cache=self.redis_cache
        )
        await self.agent_manager.initialize()
        logger.info("Agent manager initialized")
        
    def start_grpc_server(self):
        """Start the gRPC server"""
        self.server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=10),
            options=[
                ('grpc.max_send_message_length', 50 * 1024 * 1024),  # 50MB
                ('grpc.max_receive_message_length', 50 * 1024 * 1024),  # 50MB
            ]
        )
        
        # Add servicer
        servicer = AIServicer(self.agent_manager)
        # TODO: Add generated pb2_grpc services here
        # ai_service_pb2_grpc.add_AIServiceServicer_to_server(servicer, self.server)
        
        # Listen on port
        port = self.config.grpc.port
        self.server.add_insecure_port(f'[::]:{port}')
        self.server.start()
        
        logger.info(f"gRPC server started on port {port}")
        
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down AI Services...")
        
        if self.server:
            self.server.stop(grace=5)
            
        if self.agent_manager:
            await self.agent_manager.shutdown()
            
        if self.redis_cache:
            await self.redis_cache.close()
            
        if self.db_manager:
            await self.db_manager.close()
            
        logger.info("AI Services shutdown complete")
        
    async def run(self):
        """Run the server"""
        try:
            await self.initialize()
            self.start_grpc_server()
            
            # Keep server running
            logger.info("AI Services ready to accept requests")
            
            # Wait for termination signal
            stop_event = asyncio.Event()
            loop = asyncio.get_event_loop()
            
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(
                    sig, lambda: asyncio.create_task(self.handle_signal(stop_event))
                )
                
            await stop_event.wait()
            
        except Exception as e:
            logger.error(f"Server error: {e}", exc_info=True)
            sys.exit(1)
        finally:
            await self.shutdown()
            
    async def handle_signal(self, stop_event: asyncio.Event):
        """Handle shutdown signals"""
        logger.info("Received shutdown signal")
        stop_event.set()


async def main():
    """Main entry point"""
    config = Config()
    server = AIServer(config)
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())