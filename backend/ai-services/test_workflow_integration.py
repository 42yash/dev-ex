#!/usr/bin/env python3
"""
End-to-End Integration Test for Agentic Workflow System
Tests the complete workflow from user input to deployed application
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
sys.path.append(str(Path(__file__).parent))

from src.config import Config
from src.db.connection import DatabaseManager
from src.cache.redis_client import RedisCache
from src.agents.manager import AgentManager
from src.agents.agent_pool_maker import ProjectRequirements, TechnologyStack
from src.agents.orchestrator import WorkflowOrchestrator, WorkflowPhase
from src.agents.communication import MessageBus, MessageType
from src.agents.lifecycle import LifecycleManager, LifecycleState

# Test scenarios
TEST_SCENARIOS = [
    {
        "name": "E-commerce Platform",
        "input": """
        I want to build a modern e-commerce platform with the following features:
        - User authentication and profiles
        - Product catalog with search and filters  
        - Shopping cart and checkout
        - Order management and tracking
        - Admin dashboard for inventory management
        - Payment integration with Stripe
        - Email notifications
        Tech stack: Python FastAPI backend, Vue.js frontend, PostgreSQL database
        """,
        "expected_agents": ["architect", "python_backend", "frontend_vue", "database_engineer", "qa_engineer"],
        "expected_phases": 6
    },
    {
        "name": "RESTful API Service",
        "input": """
        Create a RESTful API service for a task management system:
        - CRUD operations for tasks
        - User authentication with JWT
        - Role-based access control
        - Real-time notifications via WebSocket
        - Data validation and error handling
        Tech stack: Python FastAPI, PostgreSQL, Redis for caching
        """,
        "expected_agents": ["architect", "python_backend", "database_engineer", "qa_engineer"],
        "expected_phases": 5
    },
    {
        "name": "Technical Documentation",
        "input": """
        Generate comprehensive technical documentation for our microservices architecture:
        - API documentation
        - Architecture diagrams
        - Deployment guides
        - Developer onboarding
        - Best practices and conventions
        """,
        "expected_agents": ["architect", "technical_writer"],
        "expected_phases": 3
    }
]


class WorkflowIntegrationTest:
    """Integration test suite for workflow system"""
    
    def __init__(self):
        self.config = Config()
        self.db_manager = None
        self.cache = None
        self.agent_manager = None
        self.results = []
        
    async def setup(self):
        """Setup test environment"""
        print("=" * 60)
        print("Setting up test environment...")
        print("=" * 60)
        
        # Initialize database
        self.db_manager = DatabaseManager(self.config.database.url)
        await self.db_manager.initialize()
        
        # Initialize cache
        self.cache = RedisCache(self.config.redis.url)
        await self.cache.connect()
        
        # Initialize agent manager
        self.agent_manager = AgentManager(self.config, self.db_manager, self.cache)
        await self.agent_manager.initialize()
        
        print("✓ Test environment ready")
        
    async def teardown(self):
        """Cleanup test environment"""
        print("\nCleaning up test environment...")
        
        if self.agent_manager:
            await self.agent_manager.shutdown()
        
        if self.cache:
            await self.cache.close()
        
        if self.db_manager:
            await self.db_manager.close()
        
        print("✓ Cleanup complete")
    
    async def test_workflow_creation(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Test workflow creation from user input"""
        print(f"\n📋 Testing: {scenario['name']}")
        print("-" * 40)
        
        start_time = time.time()
        result = {
            "scenario": scenario["name"],
            "success": False,
            "workflow_id": None,
            "errors": []
        }
        
        try:
            # Create workflow
            print("Creating workflow...")
            workflow = await self.agent_manager.create_workflow(
                user_input=scenario["input"],
                session_id=f"test-session-{int(time.time())}",
                user_id="test-user",
                options={"test_mode": True}
            )
            
            if not workflow:
                result["errors"].append("Failed to create workflow")
                return result
            
            result["workflow_id"] = workflow.id
            print(f"✓ Workflow created: {workflow.id}")
            
            # Validate workflow structure
            print("Validating workflow structure...")
            
            # Check phases
            if len(workflow.steps) < scenario["expected_phases"]:
                result["errors"].append(f"Expected at least {scenario['expected_phases']} phases, got {len(workflow.steps)}")
            else:
                print(f"✓ Workflow has {len(workflow.steps)} steps")
            
            # Check project type
            if workflow.project_type:
                print(f"✓ Project type: {workflow.project_type}")
            
            # Validate agents were created
            if self.agent_manager.workflow_orchestrator:
                agent_count = len(self.agent_manager.workflow_orchestrator.workflow_agents.get(workflow.id, []))
                print(f"✓ Created {agent_count} agents")
                
                if agent_count == 0:
                    result["errors"].append("No agents created for workflow")
            
            result["success"] = len(result["errors"]) == 0
            result["execution_time"] = time.time() - start_time
            
            # Store workflow details
            result["workflow"] = {
                "id": workflow.id,
                "name": workflow.name,
                "steps": len(workflow.steps),
                "project_type": workflow.project_type
            }
            
        except Exception as e:
            print(f"❌ Error: {e}")
            result["errors"].append(str(e))
            
        return result
    
    async def test_workflow_execution(self, workflow_id: str) -> Dict[str, Any]:
        """Test workflow execution"""
        print(f"\n⚡ Testing workflow execution: {workflow_id}")
        
        start_time = time.time()
        result = {
            "workflow_id": workflow_id,
            "success": False,
            "steps_completed": 0,
            "errors": []
        }
        
        try:
            # Execute workflow
            print("Starting workflow execution...")
            execution_result = await self.agent_manager.execute_workflow(workflow_id)
            
            if "error" in execution_result:
                result["errors"].append(execution_result["error"])
                return result
            
            # Check execution results
            if execution_result.get("status") == "completed":
                print(f"✓ Workflow executed successfully")
                result["steps_completed"] = execution_result.get("steps_completed", 0)
                result["success"] = True
            else:
                result["errors"].append(f"Workflow status: {execution_result.get('status')}")
            
            # Get workflow status
            status = await self.agent_manager.get_workflow_status(workflow_id)
            if status and "error" not in status:
                print(f"✓ Progress: {status.get('progress', 'unknown')}")
                print(f"✓ Percentage: {status.get('percentage', 0):.1f}%")
            
            result["execution_time"] = time.time() - start_time
            result["execution_details"] = execution_result
            
        except Exception as e:
            print(f"❌ Error: {e}")
            result["errors"].append(str(e))
            
        return result
    
    async def test_agent_communication(self) -> Dict[str, Any]:
        """Test inter-agent communication"""
        print("\n💬 Testing inter-agent communication...")
        
        result = {
            "success": False,
            "messages_sent": 0,
            "messages_received": 0,
            "errors": []
        }
        
        try:
            # Get message bus from orchestrator
            if not self.agent_manager.workflow_orchestrator:
                result["errors"].append("Workflow orchestrator not available")
                return result
            
            bus = self.agent_manager.workflow_orchestrator.message_bus
            
            # Test message sending
            test_agents = ["test_agent_1", "test_agent_2"]
            for agent_id in test_agents:
                bus.register_agent(agent_id)
            
            # Send test messages
            from src.agents.communication import Message, MessageType, MessagePriority
            
            # Direct message
            message = Message(
                type=MessageType.REQUEST,
                sender="test_agent_1",
                recipient="test_agent_2",
                payload={"test": "direct_message"},
                priority=MessagePriority.NORMAL
            )
            await bus.send_message(message)
            result["messages_sent"] += 1
            
            # Broadcast message
            broadcast = Message(
                type=MessageType.BROADCAST,
                sender="test_agent_1",
                payload={"test": "broadcast_message"},
                priority=MessagePriority.HIGH
            )
            await bus.broadcast(broadcast)
            result["messages_sent"] += 1
            
            # Check messages received
            await asyncio.sleep(0.1)  # Let messages propagate
            
            messages = await bus.get_messages("test_agent_2")
            result["messages_received"] = len(messages)
            
            if result["messages_received"] > 0:
                print(f"✓ Sent {result['messages_sent']} messages")
                print(f"✓ Received {result['messages_received']} messages")
                result["success"] = True
            else:
                result["errors"].append("No messages received")
            
            # Cleanup
            for agent_id in test_agents:
                bus.unregister_agent(agent_id)
                
        except Exception as e:
            print(f"❌ Error: {e}")
            result["errors"].append(str(e))
            
        return result
    
    async def test_agent_lifecycle(self) -> Dict[str, Any]:
        """Test agent lifecycle management"""
        print("\n🔄 Testing agent lifecycle management...")
        
        result = {
            "success": False,
            "states_tested": [],
            "errors": []
        }
        
        try:
            if not self.agent_manager.workflow_orchestrator:
                result["errors"].append("Workflow orchestrator not available")
                return result
            
            lifecycle_mgr = self.agent_manager.workflow_orchestrator.lifecycle_manager
            
            # Create a test agent state
            from src.agents.lifecycle import AgentState
            from src.agents.base import AgentType, AgentStatus
            
            test_agent_state = AgentState(
                agent_id="test_lifecycle_agent",
                name="Test Agent",
                type=AgentType.CODE,
                lifecycle_state=LifecycleState.CREATED,
                status=AgentStatus.IDLE,
                created_at=datetime.utcnow(),
                last_updated=datetime.utcnow()
            )
            
            lifecycle_mgr.agent_states[test_agent_state.agent_id] = test_agent_state
            
            # Test state transitions
            transitions = [
                (LifecycleState.INITIALIZING, "Initializing"),
                (LifecycleState.READY, "Ready"),
                (LifecycleState.RUNNING, "Running"),
                (LifecycleState.PAUSED, "Paused"),
                (LifecycleState.RUNNING, "Running again"),
                (LifecycleState.TERMINATING, "Terminating"),
                (LifecycleState.TERMINATED, "Terminated")
            ]
            
            for new_state, description in transitions:
                try:
                    await lifecycle_mgr.transition_state(test_agent_state.agent_id, new_state)
                    print(f"✓ Transitioned to {description}")
                    result["states_tested"].append(new_state.value)
                except ValueError as e:
                    if "Invalid transition" in str(e):
                        print(f"⚠️  Cannot transition to {description} (expected)")
                    else:
                        raise
            
            # Test persistence
            await lifecycle_mgr.persistence.save_state(test_agent_state)
            loaded_state = await lifecycle_mgr.persistence.load_state(test_agent_state.agent_id)
            
            if loaded_state:
                print("✓ State persistence working")
                result["success"] = True
            else:
                result["errors"].append("Failed to load persisted state")
            
            # Cleanup
            if test_agent_state.agent_id in lifecycle_mgr.agent_states:
                del lifecycle_mgr.agent_states[test_agent_state.agent_id]
                
        except Exception as e:
            print(f"❌ Error: {e}")
            result["errors"].append(str(e))
            
        return result
    
    async def test_performance_monitoring(self) -> Dict[str, Any]:
        """Test agent performance monitoring"""
        print("\n📊 Testing performance monitoring...")
        
        result = {
            "success": False,
            "metrics_collected": 0,
            "evolution_triggered": False,
            "errors": []
        }
        
        try:
            # Get Agent Darwin
            darwin = self.agent_manager.get_agent("agent_darwin")
            if not darwin:
                result["errors"].append("Agent Darwin not found")
                return result
            
            # Simulate performance metrics
            test_agent_id = "test_perf_agent"
            execution_results = [
                {"status": "success", "execution_time": 10.5, "error": None},
                {"status": "success", "execution_time": 12.3, "error": None},
                {"status": "failed", "execution_time": 30.0, "error": "Timeout"},
                {"status": "success", "execution_time": 8.7, "error": None},
                {"status": "success", "execution_time": 11.2, "error": None}
            ]
            
            for result_data in execution_results:
                metrics = await darwin.monitor_agent_performance(test_agent_id, result_data)
                result["metrics_collected"] += 1
            
            print(f"✓ Collected {result['metrics_collected']} performance metrics")
            
            # Check if evolution would be triggered
            if test_agent_id in darwin.performance_history:
                perf = darwin.performance_history[test_agent_id]
                score = perf.calculate_overall_score()
                print(f"✓ Overall performance score: {score:.2f}")
                
                if score < 0.7:
                    result["evolution_triggered"] = True
                    print("✓ Evolution would be triggered (score < 0.7)")
            
            result["success"] = result["metrics_collected"] > 0
            
        except Exception as e:
            print(f"❌ Error: {e}")
            result["errors"].append(str(e))
            
        return result
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all integration tests"""
        print("\n" + "=" * 60)
        print("AGENTIC WORKFLOW INTEGRATION TEST SUITE")
        print("=" * 60)
        
        overall_results = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "test_results": [],
            "execution_time": 0
        }
        
        start_time = time.time()
        
        try:
            # Setup
            await self.setup()
            
            # Test 1: Workflow Creation for different scenarios
            print("\n" + "=" * 60)
            print("TEST SUITE 1: WORKFLOW CREATION")
            print("=" * 60)
            
            workflow_ids = []
            for scenario in TEST_SCENARIOS:
                result = await self.test_workflow_creation(scenario)
                overall_results["test_results"].append(result)
                overall_results["total_tests"] += 1
                
                if result["success"]:
                    overall_results["passed"] += 1
                    if result["workflow_id"]:
                        workflow_ids.append(result["workflow_id"])
                else:
                    overall_results["failed"] += 1
            
            # Test 2: Workflow Execution (using first created workflow)
            if workflow_ids:
                print("\n" + "=" * 60)
                print("TEST SUITE 2: WORKFLOW EXECUTION")
                print("=" * 60)
                
                result = await self.test_workflow_execution(workflow_ids[0])
                overall_results["test_results"].append(result)
                overall_results["total_tests"] += 1
                
                if result["success"]:
                    overall_results["passed"] += 1
                else:
                    overall_results["failed"] += 1
            
            # Test 3: Agent Communication
            print("\n" + "=" * 60)
            print("TEST SUITE 3: AGENT COMMUNICATION")
            print("=" * 60)
            
            result = await self.test_agent_communication()
            overall_results["test_results"].append(result)
            overall_results["total_tests"] += 1
            
            if result["success"]:
                overall_results["passed"] += 1
            else:
                overall_results["failed"] += 1
            
            # Test 4: Agent Lifecycle
            print("\n" + "=" * 60)
            print("TEST SUITE 4: AGENT LIFECYCLE")
            print("=" * 60)
            
            result = await self.test_agent_lifecycle()
            overall_results["test_results"].append(result)
            overall_results["total_tests"] += 1
            
            if result["success"]:
                overall_results["passed"] += 1
            else:
                overall_results["failed"] += 1
            
            # Test 5: Performance Monitoring
            print("\n" + "=" * 60)
            print("TEST SUITE 5: PERFORMANCE MONITORING")
            print("=" * 60)
            
            result = await self.test_performance_monitoring()
            overall_results["test_results"].append(result)
            overall_results["total_tests"] += 1
            
            if result["success"]:
                overall_results["passed"] += 1
            else:
                overall_results["failed"] += 1
            
        except Exception as e:
            print(f"\n❌ Critical test failure: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Cleanup
            await self.teardown()
        
        overall_results["execution_time"] = time.time() - start_time
        
        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {overall_results['total_tests']}")
        print(f"Passed: {overall_results['passed']} ✓")
        print(f"Failed: {overall_results['failed']} ✗")
        if overall_results['total_tests'] > 0:
            print(f"Success Rate: {(overall_results['passed'] / overall_results['total_tests'] * 100):.1f}%")
        else:
            print("Success Rate: N/A (no tests run)")
        print(f"Total Execution Time: {overall_results['execution_time']:.2f} seconds")
        
        # Detailed failure report
        if overall_results['failed'] > 0:
            print("\n" + "=" * 60)
            print("FAILURE DETAILS")
            print("=" * 60)
            for test_result in overall_results['test_results']:
                if not test_result.get('success', False) and test_result.get('errors'):
                    test_name = test_result.get('scenario') or test_result.get('workflow_id', 'Unknown')
                    print(f"\n{test_name}:")
                    for error in test_result['errors']:
                        print(f"  - {error}")
        
        return overall_results


async def main():
    """Main test runner"""
    test_suite = WorkflowIntegrationTest()
    results = await test_suite.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if results['failed'] == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())