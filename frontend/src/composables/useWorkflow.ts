import { ref, computed } from 'vue'
import { useGrpcClient } from './useGrpcClient'
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
  const { getClient } = useGrpcClient()
  
  const activeWorkflows = ref<Map<string, Workflow>>(new Map())
  const workflowStatuses = ref<Map<string, WorkflowStatus>>(new Map())
  const workflowUpdates = ref<WorkflowUpdate[]>([])
  const isCreating = ref(false)
  const isExecuting = ref(false)
  const error = ref<string | null>(null)
  
  // Create a new workflow
  async function createWorkflow(options: CreateWorkflowOptions): Promise<Workflow | null> {
    isCreating.value = true
    error.value = null
    
    try {
      const client = await getClient()
      
      // For now, we'll simulate the workflow creation
      // In production, this would call the gRPC WorkflowService
      const workflow: Workflow = {
        workflowId: `wf_${Date.now()}`,
        name: 'New Workflow',
        description: options.userInput,
        projectType: 'web_application',
        steps: [
          {
            id: 'step1',
            phase: 'brainstorming',
            name: 'Idea Refinement',
            description: 'Refine and validate the project idea',
            agents: ['idea_generator', 'architect'],
            status: 'pending'
          },
          {
            id: 'step2',
            phase: 'requirements',
            name: 'Requirements Gathering',
            description: 'Gather and document detailed requirements',
            agents: ['architect', 'technical_writer'],
            status: 'pending'
          },
          {
            id: 'step3',
            phase: 'architecture',
            name: 'System Design',
            description: 'Design system architecture',
            agents: ['architect'],
            status: 'pending'
          },
          {
            id: 'step4',
            phase: 'development',
            name: 'Development',
            description: 'Implement the solution',
            agents: ['python_backend', 'frontend_vue'],
            status: 'pending'
          },
          {
            id: 'step5',
            phase: 'testing',
            name: 'Testing',
            description: 'Test and validate',
            agents: ['qa_engineer'],
            status: 'pending'
          }
        ],
        status: 'created'
      }
      
      activeWorkflows.value.set(workflow.workflowId, workflow)
      
      return workflow
    } catch (err) {
      console.error('Failed to create workflow:', err)
      error.value = err instanceof Error ? err.message : 'Failed to create workflow'
      return null
    } finally {
      isCreating.value = false
    }
  }
  
  // Execute a workflow
  async function executeWorkflow(workflowId: string): Promise<boolean> {
    isExecuting.value = true
    error.value = null
    
    try {
      const workflow = activeWorkflows.value.get(workflowId)
      if (!workflow) {
        throw new Error('Workflow not found')
      }
      
      // Simulate workflow execution
      workflow.status = 'in_progress'
      
      // Simulate step execution
      for (const step of workflow.steps) {
        step.status = 'in_progress'
        
        // Add update
        const update: WorkflowUpdate = {
          updateId: `update_${Date.now()}`,
          workflowId,
          type: 'step_started',
          message: `Starting ${step.name}`,
          data: { stepId: step.id },
          timestamp: new Date()
        }
        workflowUpdates.value.push(update)
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        step.status = 'completed'
        
        // Add completion update
        const completeUpdate: WorkflowUpdate = {
          updateId: `update_${Date.now()}`,
          workflowId,
          type: 'step_completed',
          message: `Completed ${step.name}`,
          data: { stepId: step.id },
          timestamp: new Date()
        }
        workflowUpdates.value.push(completeUpdate)
      }
      
      workflow.status = 'completed'
      
      return true
    } catch (err) {
      console.error('Failed to execute workflow:', err)
      error.value = err instanceof Error ? err.message : 'Failed to execute workflow'
      return false
    } finally {
      isExecuting.value = false
    }
  }
  
  // Get workflow status
  async function getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
    try {
      const workflow = activeWorkflows.value.get(workflowId)
      if (!workflow) {
        return null
      }
      
      const completedSteps = workflow.steps.filter(s => s.status === 'completed').length
      const totalSteps = workflow.steps.length
      const currentStep = workflow.steps.find(s => s.status === 'in_progress')
      
      const status: WorkflowStatus = {
        workflowId,
        name: workflow.name,
        progress: `${completedSteps}/${totalSteps}`,
        percentage: (completedSteps / totalSteps) * 100,
        currentPhase: currentStep?.phase || null,
        agents: {},
        steps: workflow.steps
      }
      
      workflowStatuses.value.set(workflowId, status)
      
      return status
    } catch (err) {
      console.error('Failed to get workflow status:', err)
      return null
    }
  }
  
  // Pause workflow
  async function pauseWorkflow(workflowId: string): Promise<boolean> {
    try {
      const workflow = activeWorkflows.value.get(workflowId)
      if (workflow) {
        workflow.status = 'paused'
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to pause workflow:', err)
      return false
    }
  }
  
  // Resume workflow
  async function resumeWorkflow(workflowId: string): Promise<boolean> {
    try {
      const workflow = activeWorkflows.value.get(workflowId)
      if (workflow) {
        workflow.status = 'in_progress'
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to resume workflow:', err)
      return false
    }
  }
  
  // Cancel workflow
  async function cancelWorkflow(workflowId: string): Promise<boolean> {
    try {
      const workflow = activeWorkflows.value.get(workflowId)
      if (workflow) {
        workflow.status = 'cancelled'
        activeWorkflows.value.delete(workflowId)
        workflowStatuses.value.delete(workflowId)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to cancel workflow:', err)
      return false
    }
  }
  
  // Stream workflow updates
  function streamWorkflowUpdates(workflowId: string, callback: (update: WorkflowUpdate) => void) {
    // In production, this would set up a gRPC stream
    // For now, we'll use a simple interval
    const interval = setInterval(() => {
      const updates = workflowUpdates.value.filter(u => u.workflowId === workflowId)
      if (updates.length > 0) {
        const latestUpdate = updates[updates.length - 1]
        callback(latestUpdate)
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }
  
  // Computed properties
  const activeWorkflowsList = computed(() => Array.from(activeWorkflows.value.values()))
  const hasActiveWorkflows = computed(() => activeWorkflows.value.size > 0)
  
  return {
    // State
    activeWorkflows: activeWorkflowsList,
    workflowStatuses,
    workflowUpdates,
    isCreating,
    isExecuting,
    error,
    hasActiveWorkflows,
    
    // Methods
    createWorkflow,
    executeWorkflow,
    getWorkflowStatus,
    pauseWorkflow,
    resumeWorkflow,
    cancelWorkflow,
    streamWorkflowUpdates
  }
}