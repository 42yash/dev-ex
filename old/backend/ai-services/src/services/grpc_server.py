"""
gRPC Server implementation for AI Services
"""

import asyncio
import grpc
from concurrent import futures
from typing import Any, AsyncIterator
import json
import structlog
from datetime import datetime
import sys
import os
import io
from contextlib import redirect_stdout, redirect_stderr

# Import generated proto files
try:
    from ..proto import chat_pb2
    from ..proto import chat_pb2_grpc
    from ..proto import common_pb2
except ImportError:
    print("Proto files not compiled. Running compilation...")
    import subprocess
    compile_script = os.path.join(os.path.dirname(__file__), '../../compile_protos.py')
    subprocess.run([sys.executable, compile_script])
    
    # Try importing again
    from ..proto import chat_pb2
    from ..proto import chat_pb2_grpc
    from ..proto import common_pb2

from ..agents.manager import AgentManager
from ..agents.base import AgentContext

logger = structlog.get_logger()


class ChatServicer(chat_pb2_grpc.ChatServiceServicer):
    """Main Chat Service implementation for gRPC"""
    
    def __init__(self, agent_manager: AgentManager):
        self.agent_manager = agent_manager
        logger.info("ChatServicer initialized")
    
    async def SendMessage(
        self,
        request: chat_pb2.SendMessageRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.SendMessageResponse:
        """Handle incoming chat messages"""
        try:
            logger.info(f"Received message for session: {request.session_id}")
            
            # Process message through agent manager
            # Get user_id from metadata if available
            metadata_dict = {}
            for key, value in context.invocation_metadata():
                metadata_dict[key] = value
            
            # Extract conversation history if available
            conversation_history = []
            if hasattr(request, 'conversation_history'):
                conversation_history = [
                    {'role': msg.role, 'content': msg.content}
                    for msg in request.conversation_history
                ]
            
            result = await self.agent_manager.process_chat_message(
                session_id=request.session_id,
                user_id=metadata_dict.get('user_id', 'anonymous'),
                message=request.message,
                conversation_history=conversation_history,
                options={
                    'context': dict(request.context) if hasattr(request, 'context') else {},
                    'options': self._parse_message_options(request.options) if request.options else {}
                }
            )
            
            # Build response
            response = chat_pb2.SendMessageResponse(
                response_id=f"resp_{datetime.utcnow().timestamp()}",
                content=result.get('content', ''),
                widgets=self._build_widgets(result.get('widgets', [])),
                suggested_actions=self._build_actions(result.get('suggested_actions', [])),
                metadata=self._build_metadata(result.get('metadata', {}))
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            raise
    
    async def StreamResponse(
        self,
        request: chat_pb2.StreamRequest,
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[chat_pb2.StreamResponse]:
        """Stream responses for real-time updates"""
        try:
            logger.info(f"Starting stream for session: {request.session_id}")
            
            # This would connect to a message queue or event stream
            # For now, simulate streaming
            chunks = [
                "Processing your request...",
                "Analyzing the information...",
                "Generating response...",
                "Here is your answer:"
            ]
            
            for i, chunk in enumerate(chunks):
                response = chat_pb2.StreamResponse(
                    chunk_id=f"chunk_{i}",
                    content=chunk,
                    is_final=(i == len(chunks) - 1),
                    widgets=[] if i < len(chunks) - 1 else self._build_widgets([])
                )
                
                yield response
                await asyncio.sleep(0.5)  # Simulate processing time
                
        except Exception as e:
            logger.error(f"Error in stream: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            raise
    
    async def GetHistory(
        self,
        request: chat_pb2.GetHistoryRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.GetHistoryResponse:
        """Get chat history for a session"""
        try:
            logger.info(f"Getting history for session: {request.session_id}")
            
            # Get messages from database
            # This would normally query the database
            messages = []
            
            # Build response
            response = chat_pb2.GetHistoryResponse(
                messages=self._build_chat_messages(messages),
                total_count=len(messages)
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error getting history: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            raise
    
    async def CreateSession(
        self,
        request: chat_pb2.CreateSessionRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.CreateSessionResponse:
        """Create a new chat session"""
        try:
            logger.info(f"Creating session for user: {request.user_id}")
            
            # Create session in agent manager
            agent = await self.agent_manager.create_conversation_agent(
                session_id=f"session_{datetime.utcnow().timestamp()}",
                user_id=request.user_id
            )
            
            # Build response
            response = chat_pb2.CreateSessionResponse(
                session_id=agent.name.replace('session_', ''),
                created_at=None  # Would set timestamp
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            raise
    
    async def EndSession(
        self,
        request: chat_pb2.EndSessionRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.EndSessionResponse:
        """End a chat session"""
        try:
            logger.info(f"Ending session: {request.session_id}")
            
            # Mark session as ended
            # This would update the database
            
            response = chat_pb2.EndSessionResponse(
                success=True,
                ended_at=None  # Would set timestamp
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error ending session: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            raise

    async def ExecuteCode(
        self,
        request: chat_pb2.ExecuteCodeRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.ExecuteCodeResponse:
        """Execute code and return the output"""
        logger.info(f"Executing code for session: {request.session_id}")

        # WARNING: This is a security risk and should not be used in production
        # without proper sandboxing and security measures.
        if request.language.lower() != "python":
            return chat_pb2.ExecuteCodeResponse(
                output=f"Error: Language '{request.language}' is not supported.",
                error=True
            )

        output_buffer = io.StringIO()
        error_buffer = io.StringIO()

        try:
            with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
                exec(request.code, {})
            output = output_buffer.getvalue()
            error = error_buffer.getvalue()

            if error:
                return chat_pb2.ExecuteCodeResponse(output=error, error=True)
            else:
                return chat_pb2.ExecuteCodeResponse(output=output, error=False)

        except Exception as e:
            return chat_pb2.ExecuteCodeResponse(output=str(e), error=True)

    async def SubmitForm(
        self,
        request: chat_pb2.SubmitFormRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.SubmitFormResponse:
        """Handle submitted form data"""
        logger.info(f"Received form submission for session: {request.session_id}, widget: {request.widget_id}")
        logger.info(f"Form data: {request.form_data}")

        # In a real application, this would involve processing the form data,
        # potentially updating a database, or triggering other agent actions.

        return chat_pb2.SubmitFormResponse(
            success=True,
            message="Form data received successfully."
        )

    async def SubmitQuizAnswer(
        self,
        request: chat_pb2.SubmitQuizAnswerRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.SubmitQuizAnswerResponse:
        """Handle submitted quiz answer"""
        logger.info(f"Received quiz answer for session: {request.session_id}, widget: {request.widget_id}")
        logger.info(f"Selected option index: {request.selected_option_index}")

        # In a real application, you would retrieve the quiz data from a database
        # or a cache based on the widget_id and session_id.
        # For this example, we'll use a mock quiz data structure.
        mock_quiz_data = {
            "question": "What is the capital of France?",
            "options": [
                {"text": "Berlin", "correct": False},
                {"text": "Madrid", "correct": False},
                {"text": "Paris", "correct": True},
                {"text": "Rome", "correct": False},
            ]
        }

        correct = False
        feedback_message = ""

        if 0 <= request.selected_option_index < len(mock_quiz_data["options"]):
            selected_option = mock_quiz_data["options"][request.selected_option_index]
            if selected_option["correct"]:
                correct = True
                feedback_message = "Correct!"
            else:
                correct = False
                correct_answer = next((opt["text"] for opt in mock_quiz_data["options"] if opt["correct"]), "")
                feedback_message = f"Incorrect. The correct answer was: {correct_answer}"
        else:
            feedback_message = "Invalid option selected."

        return chat_pb2.SubmitQuizAnswerResponse(
            correct=correct,
            feedback=feedback_message
        )

    async def GetFileTree(
        self,
        request: chat_pb2.GetFileTreeRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.GetFileTreeResponse:
        """Get file tree structure"""
        logger.info(f"Received request for file tree for session: {request.session_id}, path: {request.path}")

        # Simulate a file tree structure
        # In a real application, this would read from the actual file system
        # or a version control system.
        root_node = chat_pb2.FileTreeNode(
            name="project_root",
            is_directory=True,
            children=[
                chat_pb2.FileTreeNode(name="src", is_directory=True, children=[
                    chat_pb2.FileTreeNode(name="main.py", is_directory=False),
                    chat_pb2.FileTreeNode(name="utils.py", is_directory=False),
                ]),
                chat_pb2.FileTreeNode(name="tests", is_directory=True, children=[
                    chat_pb2.FileTreeNode(name="test_main.py", is_directory=False),
                ]),
                chat_pb2.FileTreeNode(name="README.md", is_directory=False),
            ]
        )

        return chat_pb2.GetFileTreeResponse(root=root_node)

    async def MediaInteraction(
        self,
        request: chat_pb2.MediaInteractionRequest,
        context: grpc.aio.ServicerContext
    ) -> chat_pb2.MediaInteractionResponse:
        """Handle media interaction"""
        logger.info(f"Received media interaction for session: {request.session_id}, widget: {request.widget_id}")
        logger.info(f"Media URL: {request.media_url}, Action: {request.action}")
        logger.info(f"Metadata: {request.metadata}")

        # In a real application, this would involve tracking user engagement,
        # updating analytics, or triggering other agent actions.

        return chat_pb2.MediaInteractionResponse(
            success=True,
            message=f"Media interaction '{request.action}' recorded."
        )
    
    def _parse_message_options(self, options: Any) -> dict:
        """Parse message options from proto"""
        if not options:
            return {}
        
        return {
            'stream': options.stream,
            'preferred_connector': options.preferred_connector,
            'max_tokens': options.max_tokens,
            'temperature': options.temperature
        }
    
    def _build_widgets(self, widgets: list) -> list:
        """Build widget proto messages"""
        proto_widgets = []
        
        for widget in widgets:
            # Would create proper proto widget objects
            # For now, return empty list
            pass
        
        return proto_widgets
    
    def _build_actions(self, actions: list) -> list:
        """Build action proto messages"""
        proto_actions = []
        
        for action in actions:
            # Would create proper proto action objects
            # For now, return empty list
            pass
        
        return proto_actions
    
    def _build_metadata(self, metadata: dict) -> Any:
        """Build response metadata"""
        # Would create proper proto metadata object
        # For now, return None
        return None
    
    def _build_chat_messages(self, messages: list) -> list:
        """Build chat message proto objects"""
        proto_messages = []
        
        for message in messages:
            # Would create proper proto message objects
            # For now, return empty list
            pass
        
        return proto_messages


class HealthServicer:
    """Health check service for gRPC"""
    
    async def Check(self, request: Any, context: grpc.aio.ServicerContext) -> Any:
        """Health check endpoint"""
        return {'status': 'SERVING'}
    
    async def Watch(self, request: Any, context: grpc.aio.ServicerContext) -> Any:
        """Health watch endpoint"""
        while True:
            yield {'status': 'SERVING'}
            await asyncio.sleep(5)


class GrpcServer:
    """Main gRPC server manager"""
    
    def __init__(self, agent_manager: AgentManager, port: int = 50051):
        self.agent_manager = agent_manager
        self.port = port
        self.server = None
        
    async def start(self):
        """Start the gRPC server"""
        try:
            # Create server
            self.server = grpc.aio.server(
                futures.ThreadPoolExecutor(max_workers=10),
                options=[
                    ('grpc.max_send_message_length', 50 * 1024 * 1024),
                    ('grpc.max_receive_message_length', 50 * 1024 * 1024),
                    ('grpc.keepalive_time_ms', 10000),
                    ('grpc.keepalive_timeout_ms', 5000),
                    ('grpc.keepalive_permit_without_calls', True),
                    ('grpc.http2.max_pings_without_data', 0),
                ]
            )
            
            # Add servicers
            chat_servicer = ChatServicer(self.agent_manager)
            health_servicer = HealthServicer()
            
            # Register services (would use generated registration methods)
            try:
                chat_pb2_grpc.add_ChatServiceServicer_to_server(
                    chat_servicer, self.server
                )
            except:
                logger.warning("Proto files not generated yet, skipping registration")
            
            # Add insecure port
            self.server.add_insecure_port(f'[::]:{self.port}')
            
            # Start server
            await self.server.start()
            logger.info(f"gRPC server started on port {self.port}")
            
        except Exception as e:
            logger.error(f"Failed to start gRPC server: {e}")
            raise
    
    async def stop(self):
        """Stop the gRPC server gracefully"""
        if self.server:
            logger.info("Stopping gRPC server...")
            await self.server.stop(grace=5)
            logger.info("gRPC server stopped")
    
    async def wait_for_termination(self):
        """Wait for server termination"""
        if self.server:
            await self.server.wait_for_termination()


class GrpcInterceptor(grpc.aio.ServerInterceptor):
    """Interceptor for logging and authentication"""
    
    async def intercept_service(
        self,
        continuation,
        handler_call_details: grpc.HandlerCallDetails
    ):
        """Intercept gRPC calls for logging and auth"""
        
        # Log the call
        logger.info(f"gRPC call: {handler_call_details.method}")
        
        # Check authentication (would validate JWT from metadata)
        metadata = dict(handler_call_details.invocation_metadata or {})
        
        # Continue with the call
        return await continuation(handler_call_details)


async def create_grpc_server(agent_manager: AgentManager, config: dict) -> GrpcServer:
    """Factory function to create and configure gRPC server"""
    
    port = config.get('grpc_port', 50051)
    server = GrpcServer(agent_manager, port)
    
    # Add interceptors if needed
    # server.add_interceptor(GrpcInterceptor())
    
    return server


# Proto compilation helper
def compile_protos():
    """Compile proto files to Python"""
    import subprocess
    import os
    
    proto_dir = os.path.join(os.path.dirname(__file__), '../../../../proto')
    
    try:
        # Compile proto files
        subprocess.run([
            'python', '-m', 'grpc_tools.protoc',
            f'--proto_path={proto_dir}',
            f'--python_out={proto_dir}',
            f'--grpc_python_out={proto_dir}',
            f'{proto_dir}/chat.proto',
            f'{proto_dir}/common.proto'
        ], check=True)
        
        logger.info("Proto files compiled successfully")
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to compile proto files: {e}")
    except Exception as e:
        logger.error(f"Error compiling protos: {e}")