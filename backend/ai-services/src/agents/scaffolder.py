"""
Code Scaffolding Agent - Generates complete project scaffolds
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import asyncio
from datetime import datetime

from .base import BaseAgent, AgentContext, AgentStatus, AgentType
from .execution_limiter import ExecutionLimiter
from ..config import Config

logger = logging.getLogger(__name__)


class ProjectType(Enum):
    """Supported project types"""
    WEB_APPLICATION = "web_application"
    REST_API = "rest_api"
    MICROSERVICE = "microservice"
    CLI_TOOL = "cli_tool"
    LIBRARY = "library"
    MOBILE_APP = "mobile_app"
    DATA_PIPELINE = "data_pipeline"
    MACHINE_LEARNING = "machine_learning"


@dataclass
class FileTemplate:
    """Template for a file to be generated"""
    path: str
    content: str
    description: str = ""
    is_executable: bool = False


@dataclass
class DirectoryStructure:
    """Project directory structure"""
    root: str
    directories: List[str] = field(default_factory=list)
    files: List[FileTemplate] = field(default_factory=list)
    
    def add_directory(self, path: str):
        """Add a directory to the structure"""
        if path not in self.directories:
            self.directories.append(path)
    
    def add_file(self, file: FileTemplate):
        """Add a file template to the structure"""
        self.files.append(file)


class ScaffolderAgent(BaseAgent):
    """
    Agent responsible for generating complete project scaffolds
    """
    
    def __init__(self, config: Config, execution_limiter: Optional[ExecutionLimiter] = None):
        super().__init__(
            name="scaffolder",
            agent_type=AgentType.CODE,
            system_prompt="""You are a Code Scaffolding Agent. Your role is to generate complete 
            project structures with all necessary boilerplate code, configuration files, and 
            documentation. You create production-ready project scaffolds that follow best practices 
            and industry standards.""",
            model=None,
            config={}
        )
        self.config = config
        self.execution_limiter = execution_limiter
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, Any]:
        """Load project templates"""
        return {
            ProjectType.WEB_APPLICATION: self._get_web_app_template(),
            ProjectType.REST_API: self._get_rest_api_template(),
            ProjectType.MICROSERVICE: self._get_microservice_template(),
            ProjectType.CLI_TOOL: self._get_cli_tool_template(),
        }
    
    def _get_web_app_template(self) -> Dict[str, Any]:
        """Get template for web application"""
        return {
            "frontend": {
                "vue": self._get_vue_template(),
                "react": self._get_react_template(),
            },
            "backend": {
                "fastapi": self._get_fastapi_template(),
                "django": self._get_django_template(),
            }
        }
    
    def _get_vue_template(self) -> DirectoryStructure:
        """Vue.js project template"""
        structure = DirectoryStructure(root="frontend")
        
        # Directories
        directories = [
            "src", "src/components", "src/views", "src/stores", 
            "src/router", "src/services", "src/utils", "src/assets",
            "public", "tests", "tests/unit", "tests/e2e"
        ]
        for dir in directories:
            structure.add_directory(dir)
        
        # Package.json
        structure.add_file(FileTemplate(
            path="package.json",
            content=json.dumps({
                "name": "dev-ex-frontend",
                "version": "0.1.0",
                "private": True,
                "scripts": {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview",
                    "test": "vitest",
                    "lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore"
                },
                "dependencies": {
                    "vue": "^3.3.0",
                    "vue-router": "^4.2.0",
                    "pinia": "^2.1.0",
                    "axios": "^1.6.0",
                    "@heroicons/vue": "^2.0.0"
                },
                "devDependencies": {
                    "@vitejs/plugin-vue": "^4.5.0",
                    "vite": "^5.0.0",
                    "vitest": "^1.0.0",
                    "typescript": "^5.3.0",
                    "vue-tsc": "^1.8.0",
                    "eslint": "^8.49.0",
                    "eslint-plugin-vue": "^9.17.0",
                    "@vue/eslint-config-typescript": "^12.0.0"
                }
            }, indent=2)
        ))
        
        # Main App.vue
        structure.add_file(FileTemplate(
            path="src/App.vue",
            content="""<template>
  <div id="app">
    <NavBar />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>"""
        ))
        
        # Main.ts
        structure.add_file(FileTemplate(
            path="src/main.ts",
            content="""import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')"""
        ))
        
        # Vite config
        structure.add_file(FileTemplate(
            path="vite.config.ts",
            content="""import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})"""
        ))
        
        # Router
        structure.add_file(FileTemplate(
            path="src/router/index.ts",
            content="""import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    }
  ]
})

export default router"""
        ))
        
        # TypeScript config
        structure.add_file(FileTemplate(
            path="tsconfig.json",
            content=json.dumps({
                "compilerOptions": {
                    "target": "ES2020",
                    "useDefineForClassFields": True,
                    "module": "ESNext",
                    "lib": ["ES2020", "DOM", "DOM.Iterable"],
                    "skipLibCheck": True,
                    "moduleResolution": "bundler",
                    "allowImportingTsExtensions": True,
                    "resolveJsonModule": True,
                    "isolatedModules": True,
                    "noEmit": True,
                    "jsx": "preserve",
                    "strict": True,
                    "noUnusedLocals": True,
                    "noUnusedParameters": True,
                    "noFallthroughCasesInSwitch": True,
                    "paths": {
                        "@/*": ["./src/*"]
                    }
                },
                "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
                "references": [{"path": "./tsconfig.node.json"}]
            }, indent=2)
        ))
        
        return structure
    
    def _get_react_template(self) -> DirectoryStructure:
        """React project template"""
        structure = DirectoryStructure(root="frontend")
        
        # Directories
        directories = [
            "src", "src/components", "src/pages", "src/hooks",
            "src/services", "src/utils", "src/styles", "public"
        ]
        for dir in directories:
            structure.add_directory(dir)
        
        # Package.json
        structure.add_file(FileTemplate(
            path="package.json",
            content=json.dumps({
                "name": "dev-ex-frontend",
                "version": "0.1.0",
                "private": True,
                "scripts": {
                    "dev": "vite",
                    "build": "tsc && vite build",
                    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
                    "preview": "vite preview"
                },
                "dependencies": {
                    "react": "^18.2.0",
                    "react-dom": "^18.2.0",
                    "react-router-dom": "^6.20.0",
                    "axios": "^1.6.0",
                    "zustand": "^4.4.0"
                },
                "devDependencies": {
                    "@types/react": "^18.2.0",
                    "@types/react-dom": "^18.2.0",
                    "@typescript-eslint/eslint-plugin": "^6.0.0",
                    "@typescript-eslint/parser": "^6.0.0",
                    "@vitejs/plugin-react": "^4.2.0",
                    "eslint": "^8.0.0",
                    "eslint-plugin-react-hooks": "^4.6.0",
                    "eslint-plugin-react-refresh": "^0.4.0",
                    "typescript": "^5.2.0",
                    "vite": "^5.0.0"
                }
            }, indent=2)
        ))
        
        return structure
    
    def _get_fastapi_template(self) -> DirectoryStructure:
        """FastAPI backend template"""
        structure = DirectoryStructure(root="backend")
        
        # Directories
        directories = [
            "app", "app/api", "app/api/endpoints", "app/core",
            "app/models", "app/schemas", "app/services", "app/utils",
            "tests", "migrations", "scripts"
        ]
        for dir in directories:
            structure.add_directory(dir)
        
        # Main application file
        structure.add_file(FileTemplate(
            path="app/main.py",
            content="""from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)"""
        ))
        
        # Config file
        structure.add_file(FileTemplate(
            path="app/core/config.py",
            content="""from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Dev-Ex Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "postgresql://user:pass@localhost/dbname"
    
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"

settings = Settings()"""
        ))
        
        # Requirements file
        structure.add_file(FileTemplate(
            path="requirements.txt",
            content="""fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
email-validator==2.1.0
redis==5.0.1
celery==5.3.4
httpx==0.25.2
pytest==7.4.3
pytest-asyncio==0.21.1"""
        ))
        
        # Docker file
        structure.add_file(FileTemplate(
            path="Dockerfile",
            content="""FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]"""
        ))
        
        # Database models
        structure.add_file(FileTemplate(
            path="app/models/user.py",
            content="""from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)"""
        ))
        
        return structure
    
    def _get_django_template(self) -> DirectoryStructure:
        """Django backend template"""
        structure = DirectoryStructure(root="backend")
        
        # Directories
        directories = [
            "project", "project/settings", "apps", "apps/api",
            "apps/users", "static", "media", "templates"
        ]
        for dir in directories:
            structure.add_directory(dir)
        
        # Django manage.py
        structure.add_file(FileTemplate(
            path="manage.py",
            content="""#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed?"
        ) from exc
    execute_from_command_line(sys.argv)""",
            is_executable=True
        ))
        
        return structure
    
    def _get_rest_api_template(self) -> Dict[str, Any]:
        """REST API project template"""
        return {
            "backend": {
                "fastapi": self._get_fastapi_template(),
                "express": self._get_express_template(),
            }
        }
    
    def _get_express_template(self) -> DirectoryStructure:
        """Express.js backend template"""
        structure = DirectoryStructure(root="backend")
        
        # Directories
        directories = [
            "src", "src/controllers", "src/models", "src/routes",
            "src/middleware", "src/services", "src/utils", "tests"
        ]
        for dir in directories:
            structure.add_directory(dir)
        
        # Package.json
        structure.add_file(FileTemplate(
            path="package.json",
            content=json.dumps({
                "name": "dev-ex-backend",
                "version": "1.0.0",
                "description": "REST API backend",
                "main": "dist/index.js",
                "scripts": {
                    "dev": "nodemon",
                    "build": "tsc",
                    "start": "node dist/index.js",
                    "test": "jest"
                },
                "dependencies": {
                    "express": "^4.18.0",
                    "cors": "^2.8.5",
                    "helmet": "^7.1.0",
                    "dotenv": "^16.3.0",
                    "joi": "^17.11.0",
                    "jsonwebtoken": "^9.0.0",
                    "bcryptjs": "^2.4.3",
                    "pg": "^8.11.0",
                    "redis": "^4.6.0"
                },
                "devDependencies": {
                    "@types/express": "^4.17.0",
                    "@types/node": "^20.10.0",
                    "typescript": "^5.3.0",
                    "nodemon": "^3.0.0",
                    "ts-node": "^10.9.0",
                    "jest": "^29.7.0",
                    "@types/jest": "^29.5.0"
                }
            }, indent=2)
        ))
        
        # Main server file
        structure.add_file(FileTemplate(
            path="src/index.ts",
            content="""import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});"""
        ))
        
        return structure
    
    def _get_microservice_template(self) -> Dict[str, Any]:
        """Microservice project template"""
        return {
            "service": self._get_fastapi_template(),
            "docker": self._get_docker_compose_template(),
            "kubernetes": self._get_k8s_template()
        }
    
    def _get_docker_compose_template(self) -> DirectoryStructure:
        """Docker Compose configuration"""
        structure = DirectoryStructure(root=".")
        
        structure.add_file(FileTemplate(
            path="docker-compose.yml",
            content="""version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dbname
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=dbname
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  postgres_data:"""
        ))
        
        structure.add_file(FileTemplate(
            path=".env.example",
            content="""# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here
JWT_SECRET=your-jwt-secret

# API
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000"""
        ))
        
        return structure
    
    def _get_k8s_template(self) -> DirectoryStructure:
        """Kubernetes manifests template"""
        structure = DirectoryStructure(root="k8s")
        
        # Deployment manifest
        structure.add_file(FileTemplate(
            path="deployment.yaml",
            content="""apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: LoadBalancer"""
        ))
        
        return structure
    
    def _get_cli_tool_template(self) -> Dict[str, Any]:
        """CLI tool project template"""
        return {
            "python": self._get_python_cli_template(),
            "go": self._get_go_cli_template()
        }
    
    def _get_python_cli_template(self) -> DirectoryStructure:
        """Python CLI tool template"""
        structure = DirectoryStructure(root=".")
        
        directories = ["src", "tests", "docs"]
        for dir in directories:
            structure.add_directory(dir)
        
        # Setup.py
        structure.add_file(FileTemplate(
            path="setup.py",
            content="""from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="dev-ex-cli",
    version="0.1.0",
    author="Your Name",
    description="A CLI tool for Dev-Ex platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.8",
    install_requires=[
        "click>=8.0",
        "rich>=13.0",
        "requests>=2.28",
    ],
    entry_points={
        "console_scripts": [
            "devex=devex.cli:main",
        ],
    },
)"""
        ))
        
        # Main CLI file
        structure.add_file(FileTemplate(
            path="src/devex/cli.py",
            content="""import click
from rich.console import Console
from rich.table import Table

console = Console()

@click.group()
@click.version_option(version='0.1.0')
def cli():
    \"\"\"Dev-Ex CLI - Command line interface for Dev-Ex platform\"\"\"
    pass

@cli.command()
@click.option('--name', prompt='Your name', help='The person to greet.')
def hello(name):
    \"\"\"Simple greeting command\"\"\"
    console.print(f"Hello, [bold green]{name}[/bold green]!")

@cli.command()
def status():
    \"\"\"Show system status\"\"\"
    table = Table(title="System Status")
    table.add_column("Component", style="cyan")
    table.add_column("Status", style="green")
    
    table.add_row("API", "✓ Online")
    table.add_row("Database", "✓ Connected")
    table.add_row("Cache", "✓ Active")
    
    console.print(table)

def main():
    cli()

if __name__ == '__main__':
    main()"""
        ))
        
        return structure
    
    def _get_go_cli_template(self) -> DirectoryStructure:
        """Go CLI tool template"""
        structure = DirectoryStructure(root=".")
        
        directories = ["cmd", "internal", "pkg", "test"]
        for dir in directories:
            structure.add_directory(dir)
        
        # go.mod
        structure.add_file(FileTemplate(
            path="go.mod",
            content="""module github.com/yourusername/devex-cli

go 1.21

require (
    github.com/spf13/cobra v1.8.0
    github.com/spf13/viper v1.17.0
)"""
        ))
        
        # Main file
        structure.add_file(FileTemplate(
            path="cmd/main.go",
            content="""package main

import (
    "fmt"
    "os"
    
    "github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
    Use:   "devex",
    Short: "Dev-Ex CLI tool",
    Long:  `A command line interface for the Dev-Ex platform`,
}

func main() {
    if err := rootCmd.Execute(); err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
}"""
        ))
        
        return structure
    
    async def analyze_requirements(self, requirements: str, context: AgentContext) -> Dict[str, Any]:
        """Analyze project requirements to determine structure"""
        logger.info(f"Analyzing requirements for scaffolding: {requirements[:100]}...")
        
        # Parse requirements to determine project type and technologies
        project_info = {
            "type": ProjectType.WEB_APPLICATION,
            "frontend": "vue",
            "backend": "fastapi",
            "database": "postgresql",
            "features": [],
            "dependencies": []
        }
        
        # Check for specific keywords
        requirements_lower = requirements.lower()
        
        if "api" in requirements_lower and "rest" in requirements_lower:
            project_info["type"] = ProjectType.REST_API
        elif "microservice" in requirements_lower:
            project_info["type"] = ProjectType.MICROSERVICE
        elif "cli" in requirements_lower or "command line" in requirements_lower:
            project_info["type"] = ProjectType.CLI_TOOL
        elif "mobile" in requirements_lower:
            project_info["type"] = ProjectType.MOBILE_APP
        elif "machine learning" in requirements_lower or "ml" in requirements_lower:
            project_info["type"] = ProjectType.MACHINE_LEARNING
        
        # Detect frontend framework
        if "react" in requirements_lower:
            project_info["frontend"] = "react"
        elif "angular" in requirements_lower:
            project_info["frontend"] = "angular"
        elif "svelte" in requirements_lower:
            project_info["frontend"] = "svelte"
        
        # Detect backend framework
        if "django" in requirements_lower:
            project_info["backend"] = "django"
        elif "express" in requirements_lower or "node" in requirements_lower:
            project_info["backend"] = "express"
        elif "flask" in requirements_lower:
            project_info["backend"] = "flask"
        elif "spring" in requirements_lower:
            project_info["backend"] = "spring"
        
        # Detect database
        if "mongodb" in requirements_lower or "mongo" in requirements_lower:
            project_info["database"] = "mongodb"
        elif "mysql" in requirements_lower:
            project_info["database"] = "mysql"
        elif "redis" in requirements_lower:
            project_info["features"].append("redis")
        
        # Detect features
        if "auth" in requirements_lower or "authentication" in requirements_lower:
            project_info["features"].append("authentication")
        if "docker" in requirements_lower:
            project_info["features"].append("docker")
        if "kubernetes" in requirements_lower or "k8s" in requirements_lower:
            project_info["features"].append("kubernetes")
        if "test" in requirements_lower:
            project_info["features"].append("testing")
        if "ci/cd" in requirements_lower or "cicd" in requirements_lower:
            project_info["features"].append("cicd")
        
        return project_info
    
    def generate_scaffold(self, project_info: Dict[str, Any]) -> DirectoryStructure:
        """Generate the complete project scaffold"""
        logger.info(f"Generating scaffold for {project_info['type'].value} project")
        
        project_type = project_info["type"]
        
        if project_type == ProjectType.WEB_APPLICATION:
            return self._generate_web_app_scaffold(project_info)
        elif project_type == ProjectType.REST_API:
            return self._generate_rest_api_scaffold(project_info)
        elif project_type == ProjectType.MICROSERVICE:
            return self._generate_microservice_scaffold(project_info)
        elif project_type == ProjectType.CLI_TOOL:
            return self._generate_cli_scaffold(project_info)
        else:
            # Default to web application
            return self._generate_web_app_scaffold(project_info)
    
    def _generate_web_app_scaffold(self, project_info: Dict[str, Any]) -> DirectoryStructure:
        """Generate web application scaffold"""
        root_structure = DirectoryStructure(root=".")
        
        # Get frontend template
        frontend = project_info.get("frontend", "vue")
        if frontend == "vue":
            frontend_structure = self._get_vue_template()
        elif frontend == "react":
            frontend_structure = self._get_react_template()
        else:
            frontend_structure = self._get_vue_template()
        
        # Get backend template
        backend = project_info.get("backend", "fastapi")
        if backend == "fastapi":
            backend_structure = self._get_fastapi_template()
        elif backend == "django":
            backend_structure = self._get_django_template()
        elif backend == "express":
            backend_structure = self._get_express_template()
        else:
            backend_structure = self._get_fastapi_template()
        
        # Combine structures
        for dir in frontend_structure.directories:
            root_structure.add_directory(f"frontend/{dir}")
        for file in frontend_structure.files:
            file.path = f"frontend/{file.path}"
            root_structure.add_file(file)
        
        for dir in backend_structure.directories:
            root_structure.add_directory(f"backend/{dir}")
        for file in backend_structure.files:
            file.path = f"backend/{file.path}"
            root_structure.add_file(file)
        
        # Add Docker support if requested
        if "docker" in project_info.get("features", []):
            docker_structure = self._get_docker_compose_template()
            for file in docker_structure.files:
                root_structure.add_file(file)
        
        # Add root-level files
        root_structure.add_file(FileTemplate(
            path="README.md",
            content=f"""# {project_info.get('name', 'Dev-Ex Project')}

## Overview
This project was scaffolded by the Dev-Ex Code Scaffolding Agent.

## Technology Stack
- Frontend: {frontend.title()}
- Backend: {backend.title()}
- Database: {project_info.get('database', 'PostgreSQL')}

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+ (for FastAPI backend)
- Docker & Docker Compose (optional)

### Installation

1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

### Development

1. Start the backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Docker

To run with Docker:
```bash
docker-compose up
```

## Project Structure
```
.
├── frontend/          # {frontend.title()} application
├── backend/           # {backend.title()} API
├── docker-compose.yml # Docker configuration
└── README.md         # This file
```

## License
MIT"""
        ))
        
        root_structure.add_file(FileTemplate(
            path=".gitignore",
            content="""# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/
env/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Build
dist/
build/
*.egg-info/
.pytest_cache/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.coverage
htmlcov/
.pytest_cache/

# Production
*.prod.env"""
        ))
        
        return root_structure
    
    def _generate_rest_api_scaffold(self, project_info: Dict[str, Any]) -> DirectoryStructure:
        """Generate REST API scaffold"""
        backend = project_info.get("backend", "fastapi")
        
        if backend == "fastapi":
            return self._get_fastapi_template()
        elif backend == "express":
            return self._get_express_template()
        else:
            return self._get_fastapi_template()
    
    def _generate_microservice_scaffold(self, project_info: Dict[str, Any]) -> DirectoryStructure:
        """Generate microservice scaffold"""
        root_structure = DirectoryStructure(root=".")
        
        # Get service template
        service_structure = self._get_fastapi_template()
        for dir in service_structure.directories:
            root_structure.add_directory(dir)
        for file in service_structure.files:
            root_structure.add_file(file)
        
        # Add Docker and Kubernetes
        docker_structure = self._get_docker_compose_template()
        for file in docker_structure.files:
            root_structure.add_file(file)
        
        if "kubernetes" in project_info.get("features", []):
            k8s_structure = self._get_k8s_template()
            for dir in k8s_structure.directories:
                root_structure.add_directory(dir)
            for file in k8s_structure.files:
                root_structure.add_file(file)
        
        return root_structure
    
    def _generate_cli_scaffold(self, project_info: Dict[str, Any]) -> DirectoryStructure:
        """Generate CLI tool scaffold"""
        language = project_info.get("language", "python")
        
        if language == "go":
            return self._get_go_cli_template()
        else:
            return self._get_python_cli_template()
    
    async def execute(self, input_data: str, context: AgentContext) -> Dict[str, Any]:
        """Execute the scaffolding agent"""
        logger.info(f"Scaffolder agent executing for session {context.session_id}")
        
        try:
            # Analyze requirements
            project_info = await self.analyze_requirements(input_data, context)
            
            # Generate scaffold
            scaffold = self.generate_scaffold(project_info)
            
            # Prepare output
            result = {
                "status": "success",
                "project_type": project_info["type"].value,
                "structure": {
                    "directories": scaffold.directories,
                    "files": [
                        {
                            "path": f.path,
                            "description": f.description,
                            "size": len(f.content)
                        }
                        for f in scaffold.files
                    ]
                },
                "technologies": {
                    "frontend": project_info.get("frontend"),
                    "backend": project_info.get("backend"),
                    "database": project_info.get("database")
                },
                "features": project_info.get("features", []),
                "files_content": {
                    f.path: f.content for f in scaffold.files
                },
                "total_files": len(scaffold.files),
                "total_directories": len(scaffold.directories)
            }
            
            # Store in context
            context.variables["scaffold"] = result
            
            logger.info(f"Successfully generated scaffold with {result['total_files']} files")
            return result
            
        except Exception as e:
            logger.error(f"Error generating scaffold: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }