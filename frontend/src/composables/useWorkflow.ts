import { ref, computed } from 'vue'
import type { WorkflowStep, WorkflowStatus } from '@/types/workflow'

export interface CreateWorkflowOptions {
  userInput: string
  sessionId: string
  userId: string
  options?: Record<string, any>
}

export interface Workflow {
  workflowId: string
  name: string
  description: string
  projectType: string
  steps: WorkflowStep[]
  status: string
  createdAt?: Date
  updatedAt?: Date
}

export interface WorkflowUpdate {
  updateId: string
  workflowId: string
  type: string
  message: string
  data?: any
  timestamp: Date
}

export function useWorkflow() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  
  const activeWorkflows = ref<Workflow[]>([])
  const workflowStatuses = ref<Map<string, WorkflowStatus>>(new Map())
  const workflowUpdates = ref<WorkflowUpdate[]>([])
  const isCreating = ref(false)
  const isExecuting = ref(false)
  const error = ref<string | null>(null)
  
  // Helper to get auth token
  function getAuthToken(): string | null {
    return localStorage.getItem('accessToken')
  }
  
  // Create a new workflow
  async function createWorkflow(options: CreateWorkflowOptions): Promise<Workflow | null> {
    isCreating.value = true
    error.value = null
    
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'New Workflow',
          description: options.userInput,
          userInput: options.userInput,
          projectType: options.options?.projectType || 'web_application'
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to create workflow')
      }
      
      const data = await response.json()
      
      if (data.success && data.workflow) {
        const workflow: Workflow = {
          workflowId: data.workflow.id,
          name: data.workflow.name,
          description: data.workflow.description,
          projectType: data.workflow.projectType,
          steps: data.workflow.steps,
          status: data.workflow.status,
          createdAt: data.workflow.createdAt,
          updatedAt: data.workflow.updatedAt
        }
        
        activeWorkflows.value.push(workflow)
        workflowStatuses.value.set(workflow.workflowId, workflow.status as WorkflowStatus)
        
        // Add initial update
        workflowUpdates.value.push({
          updateId: `update_${Date.now()}`,
          workflowId: workflow.workflowId,
          type: 'workflow_created',
          message: 'Workflow created successfully',
          timestamp: new Date()
        })
        
        return workflow
      }
      
      throw new Error('Invalid response from server')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create workflow'
      console.error('Error creating workflow:', err)
      return null
    } finally {
      isCreating.value = false
    }
  }
  
  // Execute workflow
  async function executeWorkflow(workflowId: string): Promise<void> {
    isExecuting.value = true
    error.value = null
    
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to execute workflow')
      }
      
      const data = await response.json()
      
      if (data.success) {
        // Update workflow status
        const workflow = activeWorkflows.value.find(w => w.workflowId === workflowId)
        if (workflow) {
          workflow.status = 'in_progress'
          workflowStatuses.value.set(workflowId, 'in_progress')
        }
        
        // Add update
        workflowUpdates.value.push({
          updateId: `update_${Date.now()}`,
          workflowId,
          type: 'workflow_started',
          message: 'Workflow execution started',
          timestamp: new Date()
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to execute workflow'
      console.error('Error executing workflow:', err)
    } finally {
      isExecuting.value = false
    }
  }
  
  // Pause workflow
  async function pauseWorkflow(workflowId: string): Promise<void> {
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/api/v1/workflows/${workflowId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to pause workflow')
      }
      
      // Update workflow status
      const workflow = activeWorkflows.value.find(w => w.workflowId === workflowId)
      if (workflow) {
        workflow.status = 'paused'
        workflowStatuses.value.set(workflowId, 'paused')
      }
      
      // Add update
      workflowUpdates.value.push({
        updateId: `update_${Date.now()}`,
        workflowId,
        type: 'workflow_paused',
        message: 'Workflow paused',
        timestamp: new Date()
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to pause workflow'
      console.error('Error pausing workflow:', err)
    }
  }
  
  // Resume workflow
  async function resumeWorkflow(workflowId: string): Promise<void> {
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/api/v1/workflows/${workflowId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to resume workflow')
      }
      
      // Update workflow status
      const workflow = activeWorkflows.value.find(w => w.workflowId === workflowId)
      if (workflow) {
        workflow.status = 'in_progress'
        workflowStatuses.value.set(workflowId, 'in_progress')
      }
      
      // Add update
      workflowUpdates.value.push({
        updateId: `update_${Date.now()}`,
        workflowId,
        type: 'workflow_resumed',
        message: 'Workflow resumed',
        timestamp: new Date()
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resume workflow'
      console.error('Error resuming workflow:', err)
    }
  }
  
  // Cancel workflow
  async function cancelWorkflow(workflowId: string): Promise<void> {
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/api/v1/workflows/${workflowId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to cancel workflow')
      }
      
      // Update workflow status
      const workflow = activeWorkflows.value.find(w => w.workflowId === workflowId)
      if (workflow) {
        workflow.status = 'cancelled'
        workflowStatuses.value.set(workflowId, 'cancelled')
      }
      
      // Add update
      workflowUpdates.value.push({
        updateId: `update_${Date.now()}`,
        workflowId,
        type: 'workflow_cancelled',
        message: 'Workflow cancelled',
        timestamp: new Date()
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to cancel workflow'
      console.error('Error cancelling workflow:', err)
    }
  }
  
  // Stream workflow updates using Server-Sent Events
  function streamWorkflowUpdates(workflowId: string): () => void {
    const token = getAuthToken()
    if (!token) {
      console.error('Not authenticated')
      return () => {}
    }
    
    const eventSource = new EventSource(
      `${API_BASE}/api/v1/workflows/${workflowId}/stream?token=${encodeURIComponent(token)}`
    )
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'update' && data.workflow) {
          // Update workflow in active list
          const index = activeWorkflows.value.findIndex(w => w.workflowId === workflowId)
          if (index >= 0) {
            activeWorkflows.value[index] = {
              workflowId: data.workflow.id,
              name: data.workflow.name,
              description: data.workflow.description,
              projectType: data.workflow.projectType,
              steps: data.workflow.steps,
              status: data.workflow.status
            }
          }
          
          // Update status map
          workflowStatuses.value.set(workflowId, data.workflow.status)
          
          // Add update to history
          workflowUpdates.value.push({
            updateId: `update_${Date.now()}`,
            workflowId,
            type: 'workflow_update',
            message: `Workflow status: ${data.workflow.status}`,
            data: data.workflow,
            timestamp: new Date()
          })
        }
      } catch (error) {
        console.error('Error parsing workflow update:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error)
      eventSource.close()
    }
    
    // Return cleanup function
    return () => {
      eventSource.close()
    }
  }
  
  // Load user workflows
  async function loadWorkflows(): Promise<void> {
    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch(`${API_BASE}/api/v1/workflows`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to load workflows')
      }
      
      const data = await response.json()
      
      if (data.success && data.workflows) {
        activeWorkflows.value = data.workflows.map((w: any) => ({
          workflowId: w.id,
          name: w.name,
          description: w.description,
          projectType: w.projectType,
          steps: w.steps,
          status: w.status,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt
        }))
        
        // Update status map
        activeWorkflows.value.forEach(w => {
          workflowStatuses.value.set(w.workflowId, w.status as WorkflowStatus)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load workflows'
      console.error('Error loading workflows:', err)
    }
  }
  
  return {
    // State
    activeWorkflows: computed(() => activeWorkflows.value),
    workflowStatuses: computed(() => workflowStatuses.value),
    workflowUpdates: computed(() => workflowUpdates.value),
    isCreating: computed(() => isCreating.value),
    isExecuting: computed(() => isExecuting.value),
    error: computed(() => error.value),
    
    // Actions
    createWorkflow,
    executeWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    cancelWorkflow,
    streamWorkflowUpdates,
    loadWorkflows
  }
}