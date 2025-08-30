#!/usr/bin/env python3
"""
Test script for Agent Pool Maker and Agent Darwin
Demonstrates dynamic agent creation and evolution
"""

import asyncio
import json
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from src.config import Config
from src.agents.agent_pool_maker import AgentPoolMaker, ProjectRequirements
from src.agents.agent_darwin import AgentDarwin
from src.agents.base import AgentContext
from src.agents.execution_limiter import ExecutionLimiter


async def test_agent_pool_maker():
    """Test Agent Pool Maker functionality"""
    print("=" * 60)
    print("Testing Agent Pool Maker (Agent 0)")
    print("=" * 60)
    
    # Initialize config and limiter
    config = Config()
    limiter = ExecutionLimiter()
    
    # Create Agent Pool Maker
    pool_maker = AgentPoolMaker(config, limiter)
    
    # Create context
    context = AgentContext(
        session_id="test-session-001",
        user_id="test-user",
        execution_id="exec-001"
    )
    
    # Test 1: Analyze requirements for a web application
    print("\n1. Testing requirement analysis for web application...")
    user_input = """
    I want to build a modern e-commerce platform with the following features:
    - User authentication and profiles
    - Product catalog with search and filters
    - Shopping cart and checkout
    - Order management
    - Admin dashboard
    - Real-time inventory updates
    - Payment integration
    
    Tech stack preferences: Python backend with FastAPI, Vue.js frontend, PostgreSQL database
    """
    
    requirements = await pool_maker.analyze_requirements(user_input, context)
    print(f"   Project Type: {requirements.project_type}")
    print(f"   Complexity: {requirements.complexity}")
    print(f"   Technologies: {[t.value for t in requirements.technologies]}")
    print(f"   Features: {requirements.features[:3]}...")  # Show first 3 features
    
    # Test 2: Determine required agents
    print("\n2. Determining required agents...")
    required_agents = pool_maker.determine_required_agents(requirements)
    print(f"   Required agents: {required_agents}")
    
    # Test 3: Create agent pool
    print("\n3. Creating agent pool...")
    result = await pool_maker.create_agent_pool(user_input, context)
    
    print(f"   Created {len(result['agents'])} agents:")
    for agent in result['agents']:
        print(f"   - {agent['name']} (ID: {agent['agent_id'][:8]}...)")
        print(f"     Responsibilities: {agent['responsibilities'][:2]}...")
    
    # Test 4: Show execution plan
    print("\n4. Execution Plan:")
    for phase in result['execution_plan']['phases']:
        print(f"   Phase {phase['phase']}: {phase['name']}")
        print(f"     Parallel execution: {phase['parallel']}")
        print(f"     Agents: {len(phase['agents'])} agents")
    
    print(f"\n   Estimated completion time: {result['estimated_time']}")
    
    return result['agents']


async def test_agent_darwin(agents):
    """Test Agent Darwin functionality"""
    print("\n" + "=" * 60)
    print("Testing Agent Darwin (Evolution System)")
    print("=" * 60)
    
    # Initialize config and limiter
    config = Config()
    limiter = ExecutionLimiter()
    
    # Create Agent Darwin
    darwin = AgentDarwin(config, limiter)
    
    # Create context
    context = AgentContext(
        session_id="test-session-002",
        user_id="test-user",
        execution_id="exec-002"
    )
    
    # Test 1: Monitor agent performance
    print("\n1. Monitoring agent performance...")
    
    # Simulate execution results for agents
    execution_results = [
        {"status": "success", "execution_time": 15.2, "error": None},
        {"status": "success", "execution_time": 22.5, "error": None},
        {"status": "failed", "execution_time": 45.0, "error": "Timeout"},
        {"status": "success", "execution_time": 18.3, "error": None},
        {"status": "success", "execution_time": 12.7, "error": None},
    ]
    
    for i, agent in enumerate(agents[:3]):  # Test first 3 agents
        print(f"\n   Monitoring {agent['name']}...")
        
        # Simulate multiple executions
        for j, result in enumerate(execution_results):
            metrics = await darwin.monitor_agent_performance(
                agent['agent_id'], 
                result
            )
            
            if j == len(execution_results) - 1:  # Show final metrics
                print(f"     Overall Score: {metrics.calculate_overall_score():.2f}")
                print(f"     Completion Rate: {metrics.task_completion_rate:.2f}")
                print(f"     Avg Response Time: {metrics.average_response_time:.1f}s")
    
    # Test 2: Analyze performance trends
    print("\n2. Analyzing performance trends...")
    
    for agent in agents[:3]:
        trend_analysis = darwin.analyze_performance_trends(agent['agent_id'])
        print(f"   {agent['name']}:")
        print(f"     Trend: {trend_analysis.get('trend', 'unknown')}")
        print(f"     Overall Score: {trend_analysis.get('overall_score', 0):.2f}")
    
    # Test 3: Generate evolution candidates
    print("\n3. Generating evolution candidates...")
    
    sample_prompt = """
    You are a backend developer agent. Your task is to:
    1. Create API endpoints
    2. Implement business logic
    3. Handle errors
    
    Respond with clean, efficient code.
    """
    
    for agent in agents[:2]:  # Test first 2 agents
        # Set up some performance history first
        darwin.performance_history[agent['agent_id']].task_completion_rate = 0.6
        darwin.performance_history[agent['agent_id']].quality_score = 0.5
        
        candidate = await darwin.evolve_agent(
            agent['agent_id'],
            sample_prompt,
            context
        )
        
        if candidate:
            print(f"\n   Evolution candidate for {agent['name']}:")
            print(f"     Strategy: {candidate.strategy.value}")
            print(f"     Expected Improvement: {candidate.expected_improvement:.2%}")
            print(f"     Risk Level: {candidate.risk_level}")
            print(f"     New prompt preview: {candidate.proposed_prompt[:100]}...")
    
    # Test 4: Optimize collaboration
    print("\n4. Testing collaboration optimization...")
    
    agent_ids = [agent['agent_id'] for agent in agents[:3]]
    collab_result = await darwin.optimize_collaboration(agent_ids, context)
    
    print(f"   Status: {collab_result['status']}")
    if collab_result['status'] == 'success':
        print(f"   Optimized collaboration for {len(collab_result['agents'])} agents")
    
    # Test 5: Generate evolution report
    print("\n5. Evolution Report:")
    report = darwin.get_evolution_report()
    
    print(f"   Total agents monitored: {report['total_agents_monitored']}")
    print(f"   Total prompt versions: {report['total_prompt_versions']}")
    print(f"   Evolution candidates: {report['evolution_candidates']}")
    
    print("\n   Agent Performance Summary:")
    for agent_id, perf in list(report['agents_performance'].items())[:3]:
        agent_name = next((a['name'] for a in agents if a['agent_id'] == agent_id), 'Unknown')
        print(f"   - {agent_name}: Score {perf['overall_score']:.2f}, Trend: {perf['trend']}")


async def main():
    """Main test function"""
    print("\n" + "=" * 60)
    print("AGENT ECOSYSTEM TEST")
    print("Demonstrating Agent Pool Maker and Agent Darwin")
    print("=" * 60)
    
    try:
        # Test Agent Pool Maker
        agents = await test_agent_pool_maker()
        
        # Test Agent Darwin with created agents
        await test_agent_darwin(agents)
        
        print("\n" + "=" * 60)
        print("TEST COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())