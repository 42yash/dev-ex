"""
Configuration management for AI Services
"""

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class DatabaseConfig:
    """Database configuration"""
    url: str
    pool_size: int = 10
    max_overflow: int = 20
    echo: bool = False


@dataclass
class RedisConfig:
    """Redis configuration"""
    url: str
    ttl: int = 3600  # 1 hour default TTL
    max_connections: int = 50


@dataclass
class GeminiConfig:
    """Google Gemini AI configuration"""
    api_key: str
    model: str = "gemini-2.5-flash"
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout: int = 30


@dataclass
class GRPCConfig:
    """gRPC server configuration"""
    port: int = 50051
    max_workers: int = 10
    max_message_size: int = 50 * 1024 * 1024  # 50MB


@dataclass
class VectorConfig:
    """Vector database configuration"""
    dimension: int = 1536
    max_chunk_size: int = 1000
    chunk_overlap: int = 200
    similarity_threshold: float = 0.7


@dataclass
class Config:
    """Main configuration class"""
    
    def __init__(self):
        self.env = os.getenv("PYTHON_ENV", "development")
        self.debug = self.env == "development"
        
        self.database = DatabaseConfig(
            url=os.getenv("DATABASE_URL", "postgresql://devex:devex@postgres:5432/devex"),
            echo=self.debug
        )
        
        self.redis = RedisConfig(
            url=os.getenv("REDIS_URL", "redis://redis:6379")
        )
        
        self.gemini = GeminiConfig(
            api_key=os.getenv("GEMINI_API_KEY", ""),
            model=os.getenv("AI_MODEL", "gemini-2.5-flash"),
            temperature=float(os.getenv("AI_TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "4096")),
            timeout=int(os.getenv("AI_TIMEOUT_SECONDS", "30"))
        )
        
        self.grpc = GRPCConfig(
            port=int(os.getenv("GRPC_PORT", "50051"))
        )
        
        self.vector = VectorConfig(
            dimension=int(os.getenv("VECTOR_DIMENSION", "1536")),
            max_chunk_size=int(os.getenv("MAX_CHUNK_SIZE", "1000")),
            chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "200"))
        )
        
    def validate(self) -> bool:
        """Validate configuration"""
        if not self.gemini.api_key:
            raise ValueError("GEMINI_API_KEY is required")
        
        return True


# Global config instance
config = Config()