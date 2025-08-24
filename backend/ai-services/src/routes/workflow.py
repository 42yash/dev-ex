"""
Workflow management API routes
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import logging

from ..agents.manager import AgentManager
from ..dependencies import get_agent_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


class CreateWorkflowRequest(BaseModel):
    """Request to create a new workflow"""
    user_input: str = Field(..., description="User's project description")
    session_id: str = Field(..., description="Session ID")
    user_id: str = Field(..., description="User ID") 
    options: Optional[Dict[str, Any]] = Field(default={}, description="Additional options")


class ExecuteWorkflowRequest(BaseModel):
    """Request to execute a workflow"""
    workflow_id: str = Field(..., description="Workflow ID to execute")


class WorkflowResponse(BaseModel):
    """Workflow response"""
    workflow_id: str
    name: str
    description: str
    project_type: str
    steps: List[Dict[str, Any]]
    status: str = "created"


@router.post("/create", response_model=WorkflowResponse)
async def create_workflow(
    request: CreateWorkflowRequest,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Create a new workflow from user input"""
    try:
        workflow = await agent_manager.create_workflow(
            user_input=request.user_input,
            session_id=request.session_id,
            user_id=request.user_id,
            options=request.options
        )
        
        if not workflow:
            raise HTTPException(status_code=500, detail="Failed to create workflow")
        
        return WorkflowResponse(
            workflow_id=workflow.id,
            name=workflow.name,
            description=workflow.description,
            project_type=workflow.project_type,
            steps=[step.to_dict() for step in workflow.steps],
            status="created"
        )
        
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute")
async def execute_workflow(
    request: ExecuteWorkflowRequest,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Execute a workflow"""
    try:
        result = await agent_manager.execute_workflow(request.workflow_id)
        return result
        
    except Exception as e:
        logger.error(f"Error executing workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{workflow_id}")
async def get_workflow_status(
    workflow_id: str,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Get the status of a workflow"""
    try:
        status = await agent_manager.get_workflow_status(workflow_id)
        
        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause/{workflow_id}")
async def pause_workflow(
    workflow_id: str,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Pause a running workflow"""
    try:
        if agent_manager.workflow_orchestrator:
            await agent_manager.workflow_orchestrator.pause_workflow(workflow_id)
            return {"status": "paused", "workflow_id": workflow_id}
        else:
            raise HTTPException(status_code=503, detail="Workflow orchestrator not available")
            
    except Exception as e:
        logger.error(f"Error pausing workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume/{workflow_id}")
async def resume_workflow(
    workflow_id: str,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Resume a paused workflow"""
    try:
        if agent_manager.workflow_orchestrator:
            await agent_manager.workflow_orchestrator.resume_workflow(workflow_id)
            return {"status": "resumed", "workflow_id": workflow_id}
        else:
            raise HTTPException(status_code=503, detail="Workflow orchestrator not available")
            
    except Exception as e:
        logger.error(f"Error resuming workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel/{workflow_id}")
async def cancel_workflow(
    workflow_id: str,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Cancel a workflow"""
    try:
        if agent_manager.workflow_orchestrator:
            await agent_manager.workflow_orchestrator.cancel_workflow(workflow_id)
            return {"status": "cancelled", "workflow_id": workflow_id}
        else:
            raise HTTPException(status_code=503, detail="Workflow orchestrator not available")
            
    except Exception as e:
        logger.error(f"Error cancelling workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active")
async def get_active_workflows(
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Get all active workflows"""
    try:
        if agent_manager.workflow_orchestrator:
            active = []
            for wf_id, workflow in agent_manager.workflow_orchestrator.active_workflows.items():
                status = await agent_manager.get_workflow_status(wf_id)
                active.append({
                    "workflow_id": wf_id,
                    "name": workflow.name,
                    "project_type": workflow.project_type,
                    "progress": status.get("progress", "0/0"),
                    "current_phase": status.get("current_phase")
                })
            return {"workflows": active}
        else:
            return {"workflows": []}
            
    except Exception as e:
        logger.error(f"Error getting active workflows: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_workflow_templates(
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Get available workflow templates"""
    try:
        # In production, this would query the workflow_templates table
        templates = [
            {
                "name": "Web Application",
                "description": "Standard workflow for web application development",
                "project_type": "web_application",
                "estimated_time": "2-4 weeks"
            },
            {
                "name": "API Service",
                "description": "Workflow for API-only service development",
                "project_type": "api_service",
                "estimated_time": "1-2 weeks"
            },
            {
                "name": "Documentation Only",
                "description": "Workflow for creating technical documentation",
                "project_type": "documentation",
                "estimated_time": "3-5 days"
            }
        ]
        
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Error getting workflow templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))