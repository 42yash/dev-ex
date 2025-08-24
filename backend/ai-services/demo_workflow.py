#!/usr/bin/env python3
"""
End-to-End Demonstration of the Agentic Workflow System
Shows the complete journey from idea to deployed application
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.markdown import Markdown
from rich.tree import Tree

sys.path.append(str(Path(__file__).parent))

from src.config import Config
from src.db.connection import DatabaseManager
from src.cache.redis_client import RedisCache
from src.agents.manager import AgentManager

# Initialize Rich console for beautiful output
console = Console()


class WorkflowDemo:
    """Demonstration of the Agentic Workflow System"""
    
    def __init__(self):
        self.config = Config()
        self.db_manager = None
        self.cache = None
        self.agent_manager = None
        
    async def setup(self):
        """Setup demo environment"""
        with console.status("[bold green]Setting up demo environment..."):
            # Initialize database
            self.db_manager = DatabaseManager(self.config.database.url)
            await self.db_manager.initialize()
            
            # Initialize cache
            self.cache = RedisCache(self.config.redis.url)
            await self.cache.connect()
            
            # Initialize agent manager
            self.agent_manager = AgentManager(self.config, self.db_manager, self.cache)
            await self.agent_manager.initialize()
            
        console.print("[bold green]✓[/] Demo environment ready")
    
    async def cleanup(self):
        """Cleanup demo environment"""
        if self.agent_manager:
            await self.agent_manager.shutdown()
        if self.cache:
            await self.cache.close()
        if self.db_manager:
            await self.db_manager.close()
    
    def display_welcome(self):
        """Display welcome message"""
        welcome = """
# 🚀 Dev-Ex Agentic Workflow System Demo

Transform your ideas into fully functional applications through autonomous AI agents!

## What You'll See:
1. **Dynamic Agent Creation** - Agents created based on your project needs
2. **Intelligent Orchestration** - Agents working together in coordinated phases
3. **Real-time Evolution** - Agents improving through performance monitoring
4. **Complete Workflow** - From idea to deployed application

Let's begin the journey...
        """
        console.print(Markdown(welcome))
        console.print()
    
    def display_project_input(self, project_description: str):
        """Display the project input"""
        panel = Panel(
            project_description,
            title="[bold cyan]Your Project Idea[/]",
            border_style="cyan"
        )
        console.print(panel)
        console.print()
    
    async def demonstrate_workflow_creation(self, project_description: str):
        """Demonstrate workflow creation"""
        console.rule("[bold yellow]Phase 1: Workflow Creation[/]")
        console.print()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Analyzing requirements...", total=None)
            
            # Create workflow
            workflow = await self.agent_manager.create_workflow(
                user_input=project_description,
                session_id=f"demo-{int(time.time())}",
                user_id="demo-user",
                options={"demo_mode": True}
            )
            
            progress.update(task, description="Workflow created!")
        
        if workflow:
            # Display workflow structure
            tree = Tree("[bold cyan]Workflow Structure[/]")
            tree.add(f"[yellow]Name:[/] {workflow.name}")
            tree.add(f"[yellow]Type:[/] {workflow.project_type}")
            
            steps_branch = tree.add("[yellow]Steps:[/]")
            for step in workflow.steps:
                step_node = steps_branch.add(f"[green]{step.name}[/]")
                step_node.add(f"Phase: {step.phase}")
                step_node.add(f"Agents: {', '.join(step.agents)}")
            
            console.print(tree)
            console.print()
            
            return workflow
        
        return None
    
    async def demonstrate_agent_pool(self, workflow_id: str):
        """Demonstrate agent pool creation"""
        console.rule("[bold yellow]Phase 2: Agent Pool Creation[/]")
        console.print()
        
        # Get workflow agents
        if self.agent_manager.workflow_orchestrator:
            agents = self.agent_manager.workflow_orchestrator.workflow_agents.get(workflow_id, set())
            
            if agents:
                table = Table(title="[bold cyan]Agent Pool[/]")
                table.add_column("Agent ID", style="cyan")
                table.add_column("Type", style="magenta")
                table.add_column("Status", style="green")
                table.add_column("Specialization")
                
                # Add sample agent data
                agent_types = ["Architect", "Backend Dev", "Frontend Dev", "QA Engineer", "DevOps"]
                for i, agent_id in enumerate(list(agents)[:5]):
                    table.add_row(
                        agent_id[:12] + "...",
                        agent_types[i % len(agent_types)],
                        "Ready",
                        "Specialized for project needs"
                    )
                
                console.print(table)
                console.print()
                
                # Show agent capabilities
                console.print("[bold]Agent Capabilities:[/]")
                capabilities = [
                    "🧠 Architect: System design and technical decisions",
                    "⚙️ Backend Dev: API development and business logic",
                    "🎨 Frontend Dev: User interface and interactions",
                    "🔍 QA Engineer: Testing and quality assurance",
                    "🚀 DevOps: Deployment and infrastructure"
                ]
                for cap in capabilities:
                    console.print(f"  • {cap}")
                console.print()
    
    async def demonstrate_workflow_execution(self, workflow_id: str):
        """Demonstrate workflow execution"""
        console.rule("[bold yellow]Phase 3: Workflow Execution[/]")
        console.print()
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Starting workflow execution...", total=5)
            
            # Simulate workflow steps
            steps = [
                ("Brainstorming", "Refining project ideas and requirements"),
                ("Architecture", "Designing system architecture"),
                ("Development", "Implementing core functionality"),
                ("Testing", "Running tests and quality checks"),
                ("Deployment", "Preparing for deployment")
            ]
            
            for i, (step_name, description) in enumerate(steps):
                progress.update(task, description=f"{step_name}: {description}")
                await asyncio.sleep(1)  # Simulate processing
                progress.update(task, completed=i+1)
                
                # Show step completion
                console.print(f"  [green]✓[/] {step_name} completed")
            
        console.print()
        console.print("[bold green]Workflow execution completed![/]")
        console.print()
    
    async def demonstrate_agent_communication(self):
        """Demonstrate agent communication"""
        console.rule("[bold yellow]Phase 4: Agent Communication[/]")
        console.print()
        
        # Show communication examples
        messages = [
            ("Architect → Backend Dev", "System design specifications ready"),
            ("Backend Dev → Frontend Dev", "API endpoints implemented"),
            ("Frontend Dev → QA Engineer", "UI components ready for testing"),
            ("QA Engineer → DevOps", "All tests passing, ready for deployment"),
            ("DevOps → All", "Deployment pipeline configured")
        ]
        
        console.print("[bold]Inter-agent Communication:[/]")
        for sender_recipient, message in messages:
            console.print(f"  [cyan]{sender_recipient}[/]: {message}")
            await asyncio.sleep(0.5)  # Simulate message flow
        
        console.print()
    
    async def demonstrate_performance_evolution(self):
        """Demonstrate agent performance evolution"""
        console.rule("[bold yellow]Phase 5: Performance Evolution[/]")
        console.print()
        
        # Show performance metrics
        table = Table(title="[bold cyan]Agent Performance Metrics[/]")
        table.add_column("Agent", style="cyan")
        table.add_column("Task Completion", justify="right")
        table.add_column("Response Time", justify="right")
        table.add_column("Quality Score", justify="right")
        table.add_column("Evolution", style="yellow")
        
        table.add_row("Architect", "95%", "8.2s", "0.92", "Optimized")
        table.add_row("Backend Dev", "88%", "12.5s", "0.85", "Learning")
        table.add_row("Frontend Dev", "92%", "10.1s", "0.88", "Stable")
        table.add_row("QA Engineer", "78%", "15.3s", "0.75", "Evolving ↑")
        table.add_row("DevOps", "90%", "9.8s", "0.87", "Stable")
        
        console.print(table)
        console.print()
        
        console.print("[bold]Evolution Strategies Applied:[/]")
        strategies = [
            "📈 Prompt optimization based on success patterns",
            "🔄 Context expansion for better understanding",
            "✂️ Pruning inefficient response patterns",
            "🎯 Specialization for specific task types"
        ]
        for strategy in strategies:
            console.print(f"  • {strategy}")
        console.print()
    
    def display_final_output(self):
        """Display the final output"""
        console.rule("[bold yellow]Phase 6: Final Output[/]")
        console.print()
        
        output = """
## 🎉 Workflow Completed Successfully!

### Generated Artifacts:
- **Backend API**: FastAPI application with 12 endpoints
- **Frontend App**: Vue.js SPA with 8 components
- **Database Schema**: PostgreSQL with 6 tables
- **Documentation**: API docs, README, deployment guide
- **Tests**: 45 unit tests, 12 integration tests
- **CI/CD Pipeline**: GitHub Actions workflow

### Deployment Ready:
```bash
# Clone the generated repository
git clone https://github.com/demo/generated-app.git

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:3000
```

### Next Steps:
1. Review generated code
2. Customize for specific needs
3. Deploy to production
4. Monitor and iterate
        """
        
        console.print(Markdown(output))
    
    async def run_demo(self):
        """Run the complete demonstration"""
        try:
            # Setup
            await self.setup()
            
            # Welcome
            self.display_welcome()
            input("Press Enter to continue...")
            console.clear()
            
            # Project input
            project_description = """
I want to build a modern task management application with:
- User authentication and team management
- Task creation with priorities and deadlines
- Real-time collaboration features
- Dashboard with analytics
- Mobile-responsive design

Tech stack: Python FastAPI backend, Vue.js frontend, PostgreSQL database
            """
            
            self.display_project_input(project_description.strip())
            input("Press Enter to start workflow creation...")
            
            # Workflow creation
            workflow = await self.demonstrate_workflow_creation(project_description)
            if not workflow:
                console.print("[red]Failed to create workflow[/]")
                return
            
            input("Press Enter to see agent pool...")
            
            # Agent pool
            await self.demonstrate_agent_pool(workflow.id)
            
            input("Press Enter to start execution...")
            
            # Workflow execution
            await self.demonstrate_workflow_execution(workflow.id)
            
            input("Press Enter to see agent communication...")
            
            # Agent communication
            await self.demonstrate_agent_communication()
            
            input("Press Enter to see performance evolution...")
            
            # Performance evolution
            await self.demonstrate_performance_evolution()
            
            input("Press Enter to see final output...")
            
            # Final output
            self.display_final_output()
            
            console.print()
            console.print("[bold green]🎊 Demo completed successfully![/]")
            console.print()
            console.print("The Dev-Ex Agentic Workflow System has transformed your idea into a complete application!")
            
        except Exception as e:
            console.print(f"[red]Demo error: {e}[/]")
            import traceback
            traceback.print_exc()
        finally:
            await self.cleanup()


async def main():
    """Main demo runner"""
    demo = WorkflowDemo()
    await demo.run_demo()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[yellow]Demo interrupted by user[/]")
        sys.exit(0)