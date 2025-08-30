"""
Inter-agent Communication Protocol for Dev-Ex Platform
Enables agents to collaborate, share context, and coordinate tasks
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from enum import Enum
import uuid
from collections import deque

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """Types of messages agents can exchange"""
    REQUEST = "request"          # Request for action
    RESPONSE = "response"        # Response to request
    BROADCAST = "broadcast"      # Broadcast to all agents
    QUERY = "query"             # Query for information
    RESULT = "result"           # Result of query
    EVENT = "event"             # Event notification
    HANDOFF = "handoff"         # Task handoff
    APPROVAL = "approval"       # Approval request
    FEEDBACK = "feedback"       # Performance feedback
    SYNC = "sync"              # State synchronization


class MessagePriority(Enum):
    """Message priority levels"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class Message:
    """Message exchanged between agents"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: MessageType = MessageType.REQUEST
    sender: str = ""
    recipient: str = ""  # Empty for broadcasts
    priority: MessagePriority = MessagePriority.NORMAL
    payload: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    requires_response: bool = False
    correlation_id: Optional[str] = None  # Links related messages
    ttl: Optional[int] = None  # Time to live in seconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary"""
        return {
            "id": self.id,
            "type": self.type.value,
            "sender": self.sender,
            "recipient": self.recipient,
            "priority": self.priority.value,
            "payload": self.payload,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
            "requires_response": self.requires_response,
            "correlation_id": self.correlation_id,
            "ttl": self.ttl
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Message":
        """Create message from dictionary"""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            type=MessageType(data.get("type", "request")),
            sender=data.get("sender", ""),
            recipient=data.get("recipient", ""),
            priority=MessagePriority(data.get("priority", 1)),
            payload=data.get("payload", {}),
            context=data.get("context", {}),
            timestamp=datetime.fromisoformat(data["timestamp"]) if "timestamp" in data else datetime.utcnow(),
            requires_response=data.get("requires_response", False),
            correlation_id=data.get("correlation_id"),
            ttl=data.get("ttl")
        )


class MessageBus:
    """Central message bus for agent communication"""
    
    def __init__(self, max_queue_size: int = 1000):
        self.subscribers: Dict[str, List[Callable]] = {}
        self.message_queue: deque = deque(maxlen=max_queue_size)
        self.pending_responses: Dict[str, asyncio.Future] = {}
        self.agent_channels: Dict[str, asyncio.Queue] = {}
        self.running = False
        self.processing_task = None
        
    async def start(self):
        """Start the message bus"""
        self.running = True
        self.processing_task = asyncio.create_task(self._process_messages())
        logger.info("Message bus started")
        
    async def stop(self):
        """Stop the message bus"""
        self.running = False
        if self.processing_task:
            await self.processing_task
        logger.info("Message bus stopped")
        
    def register_agent(self, agent_id: str, callback: Optional[Callable] = None):
        """Register an agent with the message bus"""
        if agent_id not in self.agent_channels:
            self.agent_channels[agent_id] = asyncio.Queue(maxsize=100)
        
        if callback:
            if agent_id not in self.subscribers:
                self.subscribers[agent_id] = []
            self.subscribers[agent_id].append(callback)
        
        logger.info(f"Registered agent: {agent_id}")
        
    def unregister_agent(self, agent_id: str):
        """Unregister an agent from the message bus"""
        if agent_id in self.agent_channels:
            del self.agent_channels[agent_id]
        if agent_id in self.subscribers:
            del self.subscribers[agent_id]
        logger.info(f"Unregistered agent: {agent_id}")
        
    async def send_message(self, message: Message) -> Optional[Message]:
        """Send a message through the bus"""
        # Validate message
        if not message.sender:
            raise ValueError("Message must have a sender")
        
        # Add to queue
        self.message_queue.append(message)
        
        # If requires response, wait for it
        if message.requires_response:
            future = asyncio.Future()
            self.pending_responses[message.id] = future
            
            try:
                response = await asyncio.wait_for(future, timeout=30.0)
                return response
            except asyncio.TimeoutError:
                logger.error(f"Timeout waiting for response to message {message.id}")
                del self.pending_responses[message.id]
                return None
        
        return None
        
    async def broadcast(self, message: Message):
        """Broadcast a message to all agents"""
        message.recipient = ""  # Clear recipient for broadcast
        await self.send_message(message)
        
    async def _process_messages(self):
        """Process messages from the queue"""
        while self.running:
            try:
                if self.message_queue:
                    message = self.message_queue.popleft()
                    await self._route_message(message)
                else:
                    await asyncio.sleep(0.01)  # Small delay when queue is empty
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                
    async def _route_message(self, message: Message):
        """Route a message to its recipient(s)"""
        # Handle broadcast
        if not message.recipient or message.type == MessageType.BROADCAST:
            for agent_id in self.agent_channels.keys():
                if agent_id != message.sender:  # Don't send to self
                    await self._deliver_to_agent(agent_id, message)
        else:
            # Direct message
            await self._deliver_to_agent(message.recipient, message)
            
    async def _deliver_to_agent(self, agent_id: str, message: Message):
        """Deliver a message to a specific agent"""
        if agent_id not in self.agent_channels:
            logger.warning(f"Agent {agent_id} not registered")
            return
            
        try:
            # Put message in agent's queue
            queue = self.agent_channels[agent_id]
            await queue.put(message)
            
            # Call callbacks if any
            if agent_id in self.subscribers:
                for callback in self.subscribers[agent_id]:
                    asyncio.create_task(callback(message))
                    
        except asyncio.QueueFull:
            logger.error(f"Queue full for agent {agent_id}, dropping message")
        except Exception as e:
            logger.error(f"Error delivering message to {agent_id}: {e}")
            
    async def get_messages(self, agent_id: str, timeout: Optional[float] = None) -> List[Message]:
        """Get pending messages for an agent"""
        if agent_id not in self.agent_channels:
            return []
            
        messages = []
        queue = self.agent_channels[agent_id]
        
        try:
            # Get all available messages
            while not queue.empty():
                message = await asyncio.wait_for(queue.get(), timeout=timeout or 0.1)
                messages.append(message)
        except asyncio.TimeoutError:
            pass
            
        return messages
        
    def send_response(self, original_message_id: str, response: Message):
        """Send a response to a message that required one"""
        if original_message_id in self.pending_responses:
            future = self.pending_responses[original_message_id]
            future.set_result(response)
            del self.pending_responses[original_message_id]


class AgentProtocol:
    """Protocol handler for individual agents"""
    
    def __init__(self, agent_id: str, message_bus: MessageBus):
        self.agent_id = agent_id
        self.message_bus = message_bus
        self.message_handlers: Dict[MessageType, Callable] = {}
        
        # Register with message bus
        self.message_bus.register_agent(agent_id, self._handle_message)
        
    async def send(self, recipient: str, message_type: MessageType, 
                   payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None,
                   priority: MessagePriority = MessagePriority.NORMAL,
                   requires_response: bool = False) -> Optional[Message]:
        """Send a message to another agent"""
        message = Message(
            type=message_type,
            sender=self.agent_id,
            recipient=recipient,
            priority=priority,
            payload=payload,
            context=context or {},
            requires_response=requires_response
        )
        
        return await self.message_bus.send_message(message)
        
    async def broadcast(self, message_type: MessageType, 
                        payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None,
                        priority: MessagePriority = MessagePriority.NORMAL):
        """Broadcast a message to all agents"""
        message = Message(
            type=message_type,
            sender=self.agent_id,
            recipient="",
            priority=priority,
            payload=payload,
            context=context or {}
        )
        
        await self.message_bus.broadcast(message)
        
    async def query(self, recipient: str, query: Dict[str, Any], 
                    timeout: float = 10.0) -> Optional[Dict[str, Any]]:
        """Query another agent for information"""
        response = await self.send(
            recipient=recipient,
            message_type=MessageType.QUERY,
            payload=query,
            requires_response=True
        )
        
        if response and response.type == MessageType.RESULT:
            return response.payload
        return None
        
    async def handoff_task(self, recipient: str, task: Dict[str, Any], 
                          context: Dict[str, Any]) -> bool:
        """Hand off a task to another agent"""
        response = await self.send(
            recipient=recipient,
            message_type=MessageType.HANDOFF,
            payload=task,
            context=context,
            priority=MessagePriority.HIGH,
            requires_response=True
        )
        
        return response is not None and response.payload.get("accepted", False)
        
    def register_handler(self, message_type: MessageType, handler: Callable):
        """Register a handler for a specific message type"""
        self.message_handlers[message_type] = handler
        
    async def _handle_message(self, message: Message):
        """Handle an incoming message"""
        if message.type in self.message_handlers:
            handler = self.message_handlers[message.type]
            try:
                result = await handler(message)
                
                # Send response if required
                if message.requires_response:
                    response = Message(
                        type=MessageType.RESPONSE if message.type == MessageType.REQUEST else MessageType.RESULT,
                        sender=self.agent_id,
                        recipient=message.sender,
                        payload=result if result else {"status": "ok"},
                        correlation_id=message.id
                    )
                    self.message_bus.send_response(message.id, response)
                    
            except Exception as e:
                logger.error(f"Error handling message {message.id}: {e}")
                
                # Send error response if required
                if message.requires_response:
                    response = Message(
                        type=MessageType.RESPONSE,
                        sender=self.agent_id,
                        recipient=message.sender,
                        payload={"error": str(e)},
                        correlation_id=message.id
                    )
                    self.message_bus.send_response(message.id, response)
        else:
            logger.debug(f"No handler for message type {message.type} in agent {self.agent_id}")
            
    async def get_pending_messages(self) -> List[Message]:
        """Get all pending messages for this agent"""
        return await self.message_bus.get_messages(self.agent_id)


class CollaborationCoordinator:
    """Coordinates collaboration between multiple agents"""
    
    def __init__(self, message_bus: MessageBus):
        self.message_bus = message_bus
        self.active_collaborations: Dict[str, Dict[str, Any]] = {}
        
    async def initiate_collaboration(self, collaboration_id: str, 
                                    participants: List[str],
                                    objective: str,
                                    context: Dict[str, Any]) -> bool:
        """Initiate a collaboration between agents"""
        self.active_collaborations[collaboration_id] = {
            "participants": participants,
            "objective": objective,
            "context": context,
            "status": "active",
            "started_at": datetime.utcnow()
        }
        
        # Notify all participants
        for agent_id in participants:
            message = Message(
                type=MessageType.EVENT,
                sender="collaboration_coordinator",
                recipient=agent_id,
                payload={
                    "event": "collaboration_started",
                    "collaboration_id": collaboration_id,
                    "objective": objective,
                    "participants": participants,
                    "context": context
                },
                priority=MessagePriority.HIGH
            )
            await self.message_bus.send_message(message)
            
        logger.info(f"Initiated collaboration {collaboration_id} with {len(participants)} participants")
        return True
        
    async def end_collaboration(self, collaboration_id: str, result: Dict[str, Any]):
        """End a collaboration"""
        if collaboration_id not in self.active_collaborations:
            return False
            
        collaboration = self.active_collaborations[collaboration_id]
        collaboration["status"] = "completed"
        collaboration["ended_at"] = datetime.utcnow()
        collaboration["result"] = result
        
        # Notify all participants
        for agent_id in collaboration["participants"]:
            message = Message(
                type=MessageType.EVENT,
                sender="collaboration_coordinator",
                recipient=agent_id,
                payload={
                    "event": "collaboration_ended",
                    "collaboration_id": collaboration_id,
                    "result": result
                },
                priority=MessagePriority.NORMAL
            )
            await self.message_bus.send_message(message)
            
        del self.active_collaborations[collaboration_id]
        logger.info(f"Ended collaboration {collaboration_id}")
        return True
        
    def get_active_collaborations(self) -> List[Dict[str, Any]]:
        """Get all active collaborations"""
        return [
            {
                "id": collab_id,
                **collab_data
            }
            for collab_id, collab_data in self.active_collaborations.items()
            if collab_data["status"] == "active"
        ]