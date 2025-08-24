"""
gRPC Workflow Service Implementation
"""

import asyncio
import logging
from typing import Dict, Any, Optional
import json
from datetime import datetime
import grpc
from google.protobuf import struct_pb2, timestamp_pb2

from ..agents.manager import AgentManager
from ..agents.orchestrator import WorkflowPhase

logger = logging.getLogger(__name__)


class WorkflowService:
    """gRPC service for workflow management"""
    
    def __init__(self, agent_manager: AgentManager):
        self.agent_manager = agent_manager
        self.active_streams: Dict[str, asyncio.Queue] = {}
        
    async def CreateWorkflow(self, request, context):
        """Create a new workflow from user input"""
        try:
            logger.info(f"Creating workflow for session: {request.session_id}")
            
            # Convert protobuf Struct to dict
            options = {}
            if request.HasField('options'):
                options = self._struct_to_dict(request.options)
            
            # Create workflow
            workflow = await self.agent_manager.create_workflow(
                user_input=request.user_input,
                session_id=request.session_id,
                user_id=request.user_id,
                options=options
            )
            
            if not workflow:
                context.abort(
                    grpc.StatusCode.INTERNAL,
                    "Failed to create workflow"
                )
                return
            
            # Build response
            from workflow_pb2 import CreateWorkflowResponse, WorkflowStep
            
            response = CreateWorkflowResponse()
            response.workflow_id = workflow.id
            response.name = workflow.name
            response.description = workflow.description
            response.project_type = workflow.project_type
            response.status = "created"
            
            # Add workflow steps
            for step in workflow.steps:
                proto_step = WorkflowStep()
                proto_step.id = step.id
                proto_step.phase = step.phase.value
                proto_step.name = step.name
                proto_step.description = step.description
                proto_step.status = step.status.value
                proto_step.agents.extend(step.agents)
                
                if step.inputs:
                    self._dict_to_struct(step.inputs, proto_step.inputs)
                if step.outputs:
                    self._dict_to_struct(step.outputs, proto_step.outputs)
                
                response.steps.append(proto_step)
            
            logger.info(f"Created workflow {workflow.id}")
            return response
            
        except Exception as e:
            logger.error(f"Error creating workflow: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def ExecuteWorkflow(self, request, context):
        """Execute a workflow"""
        try:
            logger.info(f"Executing workflow: {request.workflow_id}")
            
            # Execute workflow
            result = await self.agent_manager.execute_workflow(request.workflow_id)
            
            if "error" in result:
                context.abort(
                    grpc.StatusCode.NOT_FOUND,
                    result["error"]
                )
                return
            
            # Build response
            from workflow_pb2 import ExecuteWorkflowResponse
            
            response = ExecuteWorkflowResponse()
            response.workflow_id = request.workflow_id
            response.status = result.get("status", "unknown")
            response.steps_completed = result.get("steps_completed", 0)
            
            # Add agent pool
            if "agent_pool" in result:
                self._dict_to_struct(result["agent_pool"], response.agent_pool)
            
            # Add results
            if "results" in result:
                for r in result["results"]:
                    result_struct = struct_pb2.Struct()
                    self._dict_to_struct(r, result_struct)
                    response.results.append(result_struct)
            
            # Add metadata
            if "metadata" in result:
                self._dict_to_struct(result["metadata"], response.metadata)
            
            logger.info(f"Workflow {request.workflow_id} execution completed")
            return response
            
        except Exception as e:
            logger.error(f"Error executing workflow: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def GetWorkflowStatus(self, request, context):
        """Get the status of a workflow"""
        try:
            logger.info(f"Getting status for workflow: {request.workflow_id}")
            
            # Get workflow status
            status = await self.agent_manager.get_workflow_status(request.workflow_id)
            
            if "error" in status:
                context.abort(
                    grpc.StatusCode.NOT_FOUND,
                    status["error"]
                )
                return
            
            # Build response
            from workflow_pb2 import GetWorkflowStatusResponse, AgentStatus, WorkflowStep
            
            response = GetWorkflowStatusResponse()
            response.workflow_id = request.workflow_id
            response.name = status.get("name", "")
            response.progress = status.get("progress", "0/0")
            response.percentage = status.get("percentage", 0.0)
            
            if status.get("current_phase"):
                response.current_phase = status["current_phase"]
            
            # Add agent statuses
            for agent_id, agent_data in status.get("agents", {}).items():
                agent_status = AgentStatus()
                agent_status.name = agent_data.get("name", "")
                agent_status.state = agent_data.get("state", "")
                agent_status.status = agent_data.get("status", "")
                response.agents[agent_id] = agent_status
            
            # Add workflow steps
            for step_data in status.get("steps", []):
                step = WorkflowStep()
                step.id = step_data.get("id", "")
                step.phase = step_data.get("phase", "")
                step.name = step_data.get("name", "")
                step.description = step_data.get("description", "")
                step.status = step_data.get("status", "")
                
                if "agents" in step_data:
                    step.agents.extend(step_data["agents"])
                
                response.steps.append(step)
            
            return response
            
        except Exception as e:
            logger.error(f"Error getting workflow status: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def ListActiveWorkflows(self, request, context):
        """List all active workflows"""
        try:
            logger.info(f"Listing active workflows for user: {request.user_id}")
            
            # Build response
            from workflow_pb2 import ListActiveWorkflowsResponse, WorkflowSummary
            
            response = ListActiveWorkflowsResponse()
            
            if self.agent_manager.workflow_orchestrator:
                for wf_id, workflow in self.agent_manager.workflow_orchestrator.active_workflows.items():
                    # Get status
                    status = await self.agent_manager.get_workflow_status(wf_id)
                    
                    summary = WorkflowSummary()
                    summary.workflow_id = wf_id
                    summary.name = workflow.name
                    summary.project_type = workflow.project_type
                    summary.progress = status.get("progress", "0/0")
                    
                    if status.get("current_phase"):
                        summary.current_phase = status["current_phase"]
                    
                    response.workflows.append(summary)
            
            return response
            
        except Exception as e:
            logger.error(f"Error listing workflows: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def PauseWorkflow(self, request, context):
        """Pause a running workflow"""
        try:
            logger.info(f"Pausing workflow: {request.workflow_id}")
            
            if self.agent_manager.workflow_orchestrator:
                await self.agent_manager.workflow_orchestrator.pause_workflow(request.workflow_id)
                
                # Build response
                from workflow_pb2 import PauseWorkflowResponse
                
                response = PauseWorkflowResponse()
                response.status = "paused"
                response.workflow_id = request.workflow_id
                
                return response
            else:
                context.abort(
                    grpc.StatusCode.UNAVAILABLE,
                    "Workflow orchestrator not available"
                )
                
        except Exception as e:
            logger.error(f"Error pausing workflow: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def ResumeWorkflow(self, request, context):
        """Resume a paused workflow"""
        try:
            logger.info(f"Resuming workflow: {request.workflow_id}")
            
            if self.agent_manager.workflow_orchestrator:
                await self.agent_manager.workflow_orchestrator.resume_workflow(request.workflow_id)
                
                # Build response
                from workflow_pb2 import ResumeWorkflowResponse
                
                response = ResumeWorkflowResponse()
                response.status = "resumed"
                response.workflow_id = request.workflow_id
                
                return response
            else:
                context.abort(
                    grpc.StatusCode.UNAVAILABLE,
                    "Workflow orchestrator not available"
                )
                
        except Exception as e:
            logger.error(f"Error resuming workflow: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def CancelWorkflow(self, request, context):
        """Cancel a workflow"""
        try:
            logger.info(f"Cancelling workflow: {request.workflow_id}")
            
            if self.agent_manager.workflow_orchestrator:
                await self.agent_manager.workflow_orchestrator.cancel_workflow(request.workflow_id)
                
                # Build response
                from workflow_pb2 import CancelWorkflowResponse
                
                response = CancelWorkflowResponse()
                response.status = "cancelled"
                response.workflow_id = request.workflow_id
                
                return response
            else:
                context.abort(
                    grpc.StatusCode.UNAVAILABLE,
                    "Workflow orchestrator not available"
                )
                
        except Exception as e:
            logger.error(f"Error cancelling workflow: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    async def StreamWorkflowUpdates(self, request, context):
        """Stream workflow updates"""
        try:
            logger.info(f"Streaming updates for workflow: {request.workflow_id}")
            
            # Create update queue for this stream
            update_queue = asyncio.Queue()
            self.active_streams[request.workflow_id] = update_queue
            
            try:
                # Start monitoring workflow
                if self.agent_manager.workflow_orchestrator:
                    # Get workflow
                    workflow = self.agent_manager.workflow_orchestrator.active_workflows.get(request.workflow_id)
                    if not workflow:
                        context.abort(
                            grpc.StatusCode.NOT_FOUND,
                            f"Workflow {request.workflow_id} not found"
                        )
                        return
                    
                    # Stream updates
                    from workflow_pb2 import WorkflowUpdate
                    
                    while context.is_active():
                        try:
                            # Wait for update or timeout
                            update_data = await asyncio.wait_for(
                                update_queue.get(),
                                timeout=30.0
                            )
                            
                            # Build update message
                            update = WorkflowUpdate()
                            update.update_id = update_data.get("update_id", "")
                            update.workflow_id = request.workflow_id
                            update.type = update_data.get("type", "")
                            update.message = update_data.get("message", "")
                            
                            if "data" in update_data:
                                self._dict_to_struct(update_data["data"], update.data)
                            
                            # Set timestamp
                            update.timestamp.GetCurrentTime()
                            
                            yield update
                            
                        except asyncio.TimeoutError:
                            # Send heartbeat
                            update = WorkflowUpdate()
                            update.update_id = f"heartbeat_{datetime.utcnow().timestamp()}"
                            update.workflow_id = request.workflow_id
                            update.type = "heartbeat"
                            update.message = "Still monitoring workflow"
                            update.timestamp.GetCurrentTime()
                            
                            yield update
                            
            finally:
                # Clean up
                if request.workflow_id in self.active_streams:
                    del self.active_streams[request.workflow_id]
                    
        except Exception as e:
            logger.error(f"Error streaming workflow updates: {e}")
            context.abort(
                grpc.StatusCode.INTERNAL,
                str(e)
            )
    
    def _dict_to_struct(self, dict_obj: Dict[str, Any], struct_obj: struct_pb2.Struct):
        """Convert Python dict to protobuf Struct"""
        for key, value in dict_obj.items():
            if isinstance(value, dict):
                nested_struct = struct_obj[key]
                self._dict_to_struct(value, nested_struct)
            elif isinstance(value, list):
                list_value = struct_obj[key]
                for item in value:
                    if isinstance(item, dict):
                        struct_item = list_value.add()
                        self._dict_to_struct(item, struct_item)
                    else:
                        list_value.append(item)
            elif value is None:
                struct_obj[key] = None
            else:
                struct_obj[key] = value
    
    def _struct_to_dict(self, struct_obj: struct_pb2.Struct) -> Dict[str, Any]:
        """Convert protobuf Struct to Python dict"""
        result = {}
        for key, value in struct_obj.items():
            if isinstance(value, struct_pb2.Struct):
                result[key] = self._struct_to_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    self._struct_to_dict(item) if isinstance(item, struct_pb2.Struct) else item
                    for item in value
                ]
            else:
                result[key] = value
        return result
    
    async def send_workflow_update(self, workflow_id: str, update_data: Dict[str, Any]):
        """Send an update to workflow stream subscribers"""
        if workflow_id in self.active_streams:
            queue = self.active_streams[workflow_id]
            await queue.put(update_data)