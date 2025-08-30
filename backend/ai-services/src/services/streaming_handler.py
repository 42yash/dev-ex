"""
Streaming handler for AI model responses
Provides real-time token streaming capabilities
"""

import asyncio
import time
import json
from typing import AsyncGenerator, Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import google.generativeai as genai
from google.generativeai.types import GenerationConfig, GenerateContentResponse
import structlog

logger = structlog.get_logger()


class StreamEventType(Enum):
    """Types of streaming events"""
    START = "stream.start"
    CHUNK = "stream.chunk"
    END = "stream.end"
    ERROR = "stream.error"
    HEARTBEAT = "stream.heartbeat"


@dataclass
class StreamEvent:
    """Streaming event data structure"""
    type: StreamEventType
    session_id: str
    message_id: str
    chunk: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "type": self.type.value,
            "sessionId": self.session_id,
            "messageId": self.message_id,
            "chunk": self.chunk,
            "metadata": self.metadata,
            "error": self.error,
            "timestamp": self.timestamp
        }


class StreamingHandler:
    """Handles streaming responses from AI models"""
    
    def __init__(self, model: Optional[genai.GenerativeModel] = None):
        self.model = model
        self.active_streams: Dict[str, bool] = {}
        self.stream_metrics: Dict[str, Dict[str, Any]] = {}
        
    async def stream_gemini_response(
        self,
        prompt: str,
        session_id: str,
        message_id: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stop_sequences: Optional[List[str]] = None
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        Stream response from Gemini model
        
        Args:
            prompt: Input prompt
            session_id: Session identifier
            message_id: Message identifier
            temperature: Generation temperature
            max_tokens: Maximum tokens to generate
            stop_sequences: Optional stop sequences
            
        Yields:
            StreamEvent objects with response chunks
        """
        
        if not self.model:
            yield StreamEvent(
                type=StreamEventType.ERROR,
                session_id=session_id,
                message_id=message_id,
                error="Model not initialized"
            )
            return
        
        # Mark stream as active
        stream_key = f"{session_id}:{message_id}"
        self.active_streams[stream_key] = True
        
        # Initialize metrics
        self.stream_metrics[stream_key] = {
            "start_time": time.time(),
            "first_token_time": None,
            "token_count": 0,
            "chunk_count": 0
        }
        
        try:
            # Send start event
            yield StreamEvent(
                type=StreamEventType.START,
                session_id=session_id,
                message_id=message_id,
                metadata={
                    "model": self.model.model_name,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )
            
            # Configure generation
            generation_config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                stop_sequences=stop_sequences or []
            )
            
            # Start streaming
            response = await self.model.generate_content_async(
                prompt,
                stream=True,
                generation_config=generation_config
            )
            
            total_text = ""
            first_chunk = True
            
            async for chunk in response:
                # Check if stream was cancelled
                if not self.active_streams.get(stream_key, False):
                    logger.info(f"Stream cancelled: {stream_key}")
                    break
                
                if chunk.text:
                    # Update metrics
                    metrics = self.stream_metrics[stream_key]
                    if first_chunk:
                        metrics["first_token_time"] = time.time()
                        first_chunk = False
                    
                    metrics["token_count"] += len(chunk.text.split())
                    metrics["chunk_count"] += 1
                    
                    total_text += chunk.text
                    
                    # Send chunk event
                    yield StreamEvent(
                        type=StreamEventType.CHUNK,
                        session_id=session_id,
                        message_id=message_id,
                        chunk=chunk.text,
                        metadata={
                            "token_count": metrics["token_count"],
                            "chunk_index": metrics["chunk_count"]
                        }
                    )
                    
                    # Small delay to prevent overwhelming
                    await asyncio.sleep(0.01)
            
            # Calculate final metrics
            metrics = self.stream_metrics[stream_key]
            end_time = time.time()
            total_time = end_time - metrics["start_time"]
            
            # Send end event
            yield StreamEvent(
                type=StreamEventType.END,
                session_id=session_id,
                message_id=message_id,
                metadata={
                    "total_tokens": metrics["token_count"],
                    "total_chunks": metrics["chunk_count"],
                    "total_time": total_time,
                    "first_token_latency": metrics["first_token_time"] - metrics["start_time"] if metrics["first_token_time"] else None,
                    "tokens_per_second": metrics["token_count"] / total_time if total_time > 0 else 0,
                    "complete_text": total_text
                }
            )
            
        except asyncio.CancelledError:
            logger.info(f"Stream cancelled: {stream_key}")
            yield StreamEvent(
                type=StreamEventType.ERROR,
                session_id=session_id,
                message_id=message_id,
                error="Stream cancelled by user"
            )
            
        except Exception as e:
            logger.error(f"Stream error for {stream_key}: {e}")
            yield StreamEvent(
                type=StreamEventType.ERROR,
                session_id=session_id,
                message_id=message_id,
                error=str(e)
            )
            
        finally:
            # Clean up
            self.active_streams.pop(stream_key, None)
            self.stream_metrics.pop(stream_key, None)
    
    async def stream_with_heartbeat(
        self,
        prompt: str,
        session_id: str,
        message_id: str,
        heartbeat_interval: float = 30.0,
        **kwargs
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        Stream response with periodic heartbeat events
        Useful for keeping connections alive
        """
        
        stream_key = f"{session_id}:{message_id}"
        last_event_time = time.time()
        
        async def heartbeat_generator():
            """Generate heartbeat events"""
            while self.active_streams.get(stream_key, False):
                await asyncio.sleep(heartbeat_interval)
                current_time = time.time()
                if current_time - last_event_time >= heartbeat_interval:
                    yield StreamEvent(
                        type=StreamEventType.HEARTBEAT,
                        session_id=session_id,
                        message_id=message_id,
                        metadata={"timestamp": current_time}
                    )
        
        # Create tasks for both streams
        main_stream = self.stream_gemini_response(
            prompt, session_id, message_id, **kwargs
        )
        heartbeat_stream = heartbeat_generator()
        
        # Merge streams
        main_task = asyncio.create_task(main_stream.__anext__())
        heartbeat_task = asyncio.create_task(heartbeat_stream.__anext__())
        
        pending = {main_task, heartbeat_task}
        
        try:
            while pending:
                done, pending = await asyncio.wait(
                    pending, return_when=asyncio.FIRST_COMPLETED
                )
                
                for task in done:
                    try:
                        event = task.result()
                        last_event_time = time.time()
                        yield event
                        
                        # Schedule next event from the same stream
                        if task == main_task:
                            if event.type != StreamEventType.END:
                                main_task = asyncio.create_task(main_stream.__anext__())
                                pending.add(main_task)
                        else:
                            heartbeat_task = asyncio.create_task(heartbeat_stream.__anext__())
                            pending.add(heartbeat_task)
                            
                    except StopAsyncIteration:
                        # Stream ended
                        if task == main_task:
                            # Main stream ended, cancel heartbeat
                            heartbeat_task.cancel()
                            pending.discard(heartbeat_task)
                        
        finally:
            # Clean up tasks
            for task in pending:
                task.cancel()
    
    def cancel_stream(self, session_id: str, message_id: str) -> bool:
        """
        Cancel an active stream
        
        Returns:
            True if stream was active and cancelled, False otherwise
        """
        stream_key = f"{session_id}:{message_id}"
        if stream_key in self.active_streams:
            self.active_streams[stream_key] = False
            logger.info(f"Cancelled stream: {stream_key}")
            return True
        return False
    
    def get_active_streams(self) -> List[str]:
        """Get list of active stream keys"""
        return [key for key, active in self.active_streams.items() if active]
    
    def get_stream_metrics(self, session_id: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Get metrics for a specific stream"""
        stream_key = f"{session_id}:{message_id}"
        return self.stream_metrics.get(stream_key)


class StreamBuffer:
    """Buffer for managing streaming chunks"""
    
    def __init__(self, max_size: int = 100):
        self.buffer: List[str] = []
        self.max_size = max_size
        self.total_chunks = 0
        
    def add_chunk(self, chunk: str):
        """Add a chunk to the buffer"""
        self.buffer.append(chunk)
        self.total_chunks += 1
        
        # Maintain max size
        if len(self.buffer) > self.max_size:
            self.buffer.pop(0)
    
    def get_text(self) -> str:
        """Get concatenated text from buffer"""
        return "".join(self.buffer)
    
    def clear(self):
        """Clear the buffer"""
        self.buffer.clear()
    
    def get_last_n_chunks(self, n: int) -> List[str]:
        """Get last n chunks from buffer"""
        return self.buffer[-n:] if n <= len(self.buffer) else self.buffer.copy()


# Global streaming handler instance
streaming_handler = StreamingHandler()