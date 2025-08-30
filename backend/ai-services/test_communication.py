#!/usr/bin/env python3
"""
Test script for Inter-agent Communication Protocol
"""

import asyncio
import json
from datetime import datetime
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from src.agents.communication import (
    MessageBus, AgentProtocol, Message, MessageType, 
    MessagePriority, CollaborationCoordinator
)


async def test_message_bus():
    """Test basic message bus functionality"""
    print("=" * 60)
    print("Testing Message Bus")
    print("=" * 60)
    
    # Create message bus
    bus = MessageBus()
    await bus.start()
    
    # Create agent protocols
    agent1 = AgentProtocol("agent1", bus)
    agent2 = AgentProtocol("agent2", bus)
    agent3 = AgentProtocol("agent3", bus)
    
    print("\n1. Testing direct messaging...")
    
    # Agent1 sends message to Agent2
    message = await agent1.send(
        recipient="agent2",
        message_type=MessageType.REQUEST,
        payload={"task": "analyze_code", "file": "main.py"},
        context={"session_id": "test-123"}
    )
    
    # Let message propagate
    await asyncio.sleep(0.1)
    
    # Agent2 checks messages
    messages = await agent2.get_pending_messages()
    print(f"   Agent2 received {len(messages)} message(s)")
    if messages:
        msg = messages[0]
        print(f"   Message type: {msg.type.value}")
        print(f"   Payload: {msg.payload}")
    
    print("\n2. Testing broadcast messaging...")
    
    # Agent1 broadcasts to all
    await agent1.broadcast(
        message_type=MessageType.EVENT,
        payload={"event": "deployment_started", "version": "1.0.0"},
        priority=MessagePriority.HIGH
    )
    
    # Let message propagate
    await asyncio.sleep(0.1)
    
    # Check messages for agent2 and agent3
    messages2 = await agent2.get_pending_messages()
    messages3 = await agent3.get_pending_messages()
    
    print(f"   Agent2 received broadcast: {len(messages2) > 0}")
    print(f"   Agent3 received broadcast: {len(messages3) > 0}")
    
    print("\n3. Testing request-response pattern...")
    
    # Register handler for agent2
    async def handle_query(message: Message):
        print(f"   Agent2 handling query: {message.payload}")
        return {"result": "query_processed", "data": [1, 2, 3]}
    
    agent2.register_handler(MessageType.QUERY, handle_query)
    
    # Agent1 queries Agent2
    result = await agent1.query(
        recipient="agent2",
        query={"type": "get_metrics", "timeframe": "1h"}
    )
    
    print(f"   Query result: {result}")
    
    await bus.stop()
    print("\nMessage bus test completed")


async def test_collaboration():
    """Test collaboration coordination"""
    print("\n" + "=" * 60)
    print("Testing Collaboration Coordination")
    print("=" * 60)
    
    # Create message bus and coordinator
    bus = MessageBus()
    await bus.start()
    coordinator = CollaborationCoordinator(bus)
    
    # Create agents
    agents = {
        "backend_dev": AgentProtocol("backend_dev", bus),
        "frontend_dev": AgentProtocol("frontend_dev", bus),
        "qa_engineer": AgentProtocol("qa_engineer", bus)
    }
    
    print("\n1. Initiating collaboration...")
    
    # Register handlers for collaboration events
    collaboration_events = []
    
    async def handle_collab_event(message: Message):
        collaboration_events.append(message.payload)
        print(f"   {message.recipient} received: {message.payload['event']}")
    
    for agent_id, protocol in agents.items():
        protocol.register_handler(MessageType.EVENT, handle_collab_event)
    
    # Initiate collaboration
    success = await coordinator.initiate_collaboration(
        collaboration_id="feature-123",
        participants=list(agents.keys()),
        objective="Implement user authentication feature",
        context={
            "requirements": ["OAuth2", "JWT tokens", "Role-based access"],
            "deadline": "2024-01-15"
        }
    )
    
    print(f"   Collaboration initiated: {success}")
    
    # Let messages propagate
    await asyncio.sleep(0.1)
    
    print(f"   Total events received: {len(collaboration_events)}")
    
    print("\n2. Active collaborations...")
    active = coordinator.get_active_collaborations()
    print(f"   Active collaborations: {len(active)}")
    if active:
        collab = active[0]
        print(f"   - ID: {collab['id']}")
        print(f"   - Objective: {collab['objective']}")
        print(f"   - Participants: {collab['participants']}")
    
    print("\n3. Ending collaboration...")
    
    # End collaboration
    await coordinator.end_collaboration(
        collaboration_id="feature-123",
        result={
            "status": "completed",
            "deliverables": ["auth_module.py", "auth_tests.py", "auth_docs.md"]
        }
    )
    
    # Let messages propagate
    await asyncio.sleep(0.1)
    
    print(f"   End events sent to all participants")
    
    await bus.stop()
    print("\nCollaboration test completed")


async def test_handoff():
    """Test task handoff between agents"""
    print("\n" + "=" * 60)
    print("Testing Task Handoff")
    print("=" * 60)
    
    bus = MessageBus()
    await bus.start()
    
    # Create specialized agents
    architect = AgentProtocol("architect", bus)
    developer = AgentProtocol("developer", bus)
    tester = AgentProtocol("tester", bus)
    
    print("\n1. Setting up handoff handlers...")
    
    # Developer accepts handoffs from architect
    async def handle_dev_handoff(message: Message):
        task = message.payload
        print(f"   Developer received task: {task['name']}")
        # Simulate work
        await asyncio.sleep(0.1)
        return {"accepted": True, "estimated_time": "2 hours"}
    
    developer.register_handler(MessageType.HANDOFF, handle_dev_handoff)
    
    # Tester accepts handoffs from developer
    async def handle_test_handoff(message: Message):
        task = message.payload
        print(f"   Tester received task: {task['name']}")
        return {"accepted": True, "estimated_time": "1 hour"}
    
    tester.register_handler(MessageType.HANDOFF, handle_test_handoff)
    
    print("\n2. Architect hands off to Developer...")
    
    # Architect creates design and hands off to developer
    dev_accepted = await architect.handoff_task(
        recipient="developer",
        task={
            "name": "implement_api_endpoints",
            "specifications": {
                "endpoints": ["/api/users", "/api/products"],
                "methods": ["GET", "POST", "PUT", "DELETE"]
            }
        },
        context={"project_id": "proj-123", "phase": "development"}
    )
    
    print(f"   Developer accepted: {dev_accepted}")
    
    print("\n3. Developer hands off to Tester...")
    
    # Developer completes and hands off to tester
    test_accepted = await developer.handoff_task(
        recipient="tester",
        task={
            "name": "test_api_endpoints",
            "artifacts": ["api_endpoints.py", "api_tests.py"],
            "coverage_target": 0.8
        },
        context={"project_id": "proj-123", "phase": "testing"}
    )
    
    print(f"   Tester accepted: {test_accepted}")
    
    await bus.stop()
    print("\nHandoff test completed")


async def test_priority_messages():
    """Test message priority handling"""
    print("\n" + "=" * 60)
    print("Testing Message Priority")
    print("=" * 60)
    
    bus = MessageBus()
    await bus.start()
    
    sender = AgentProtocol("sender", bus)
    receiver = AgentProtocol("receiver", bus)
    
    print("\n1. Sending messages with different priorities...")
    
    # Send messages with different priorities
    priorities = [
        (MessagePriority.LOW, "low_priority_task"),
        (MessagePriority.CRITICAL, "critical_alert"),
        (MessagePriority.NORMAL, "normal_task"),
        (MessagePriority.HIGH, "high_priority_fix")
    ]
    
    for priority, task in priorities:
        await sender.send(
            recipient="receiver",
            message_type=MessageType.REQUEST,
            payload={"task": task},
            priority=priority
        )
        print(f"   Sent {priority.name} priority: {task}")
    
    # Let messages propagate
    await asyncio.sleep(0.1)
    
    print("\n2. Receiving messages...")
    
    messages = await receiver.get_pending_messages()
    print(f"   Received {len(messages)} messages")
    
    for msg in messages:
        print(f"   - Priority {msg.priority.name}: {msg.payload['task']}")
    
    await bus.stop()
    print("\nPriority test completed")


async def main():
    """Main test function"""
    print("\n" + "=" * 60)
    print("INTER-AGENT COMMUNICATION PROTOCOL TEST")
    print("=" * 60)
    
    try:
        # Test message bus
        await test_message_bus()
        
        # Test collaboration
        await test_collaboration()
        
        # Test task handoff
        await test_handoff()
        
        # Test priority messages
        await test_priority_messages()
        
        print("\n" + "=" * 60)
        print("ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())