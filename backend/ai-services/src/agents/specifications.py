"""
Agent specifications and data structures
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum
import uuid

from .base import AgentType


class TechnologyStack(Enum):
    """Supported technology stacks"""
    PYTHON_FASTAPI = "python_fastapi"
    PYTHON_DJANGO = "python_django"
    PYTHON_FLASK = "python_flask"
    NODEJS_EXPRESS = "nodejs_express"
    NODEJS_NESTJS = "nodejs_nestjs"
    VUE_TYPESCRIPT = "vue_typescript"
    REACT_TYPESCRIPT = "react_typescript"
    ANGULAR = "angular"
    GOLANG = "golang"
    RUST = "rust"
    DATABASE_POSTGRES = "database_postgres"
    DATABASE_MONGODB = "database_mongodb"
    DATABASE_REDIS = "database_redis"
    DOCKER = "docker"
    KUBERNETES = "kubernetes"
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"


@dataclass
class AgentSpecification:
    """Specification for creating an agent"""
    agent_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    type: AgentType = AgentType.CODE
    technologies: List[TechnologyStack] = field(default_factory=list)
    responsibilities: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)  # IDs of other agents
    tools: List[str] = field(default_factory=list)
    context_requirements: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "type": self.type.value,
            "technologies": [t.value for t in self.technologies],
            "responsibilities": self.responsibilities,
            "dependencies": self.dependencies,
            "tools": self.tools,
            "context_requirements": self.context_requirements,
            "performance_metrics": self.performance_metrics,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class ProjectRequirements:
    """Analyzed project requirements"""
    project_type: str = ""  # web_app, api, cli, mobile, etc.
    technologies: set = field(default_factory=set)
    features: List[str] = field(default_factory=list)
    complexity: str = "medium"  # simple, medium, complex
    timeline: str = "standard"  # urgent, standard, relaxed
    team_size: int = 1
    has_authentication: bool = False
    has_database: bool = False
    has_realtime: bool = False
    has_deployment: bool = False
    has_testing: bool = True
    has_documentation: bool = True