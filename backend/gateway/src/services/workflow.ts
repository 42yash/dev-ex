import { query } from '../db/index.js'
import { getRedis } from './redis.js'
import { workflowEvents } from './workflowEvents.js'
import { logger } from '../utils/logger.js'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load workflow proto
const PROTO_PATH = path.join(__dirname, '../../../../proto/workflow.proto')
let workflowClient: any = null

// Initialize gRPC client for workflow service
async function initWorkflowClient() {
  try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    })
    
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any
    const WorkflowService = protoDescriptor.workflow.WorkflowService
    
    workflowClient = new WorkflowService(
      process.env.AI_SERVICE_URL || 'localhost:50051',
      grpc.credentials.createInsecure()
    )
    
    logger.info('Workflow gRPC client initialized')
  } catch (error) {
    logger.error('Failed to initialize workflow client:', error)
  }
}

// Initialize on module load
initWorkflowClient()

export interface WorkflowStep {
  id: string
  phase: string
  name: string
  description: string
  agents: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  result?: any
}

export interface Workflow {
  id: string
  userId: string
  name: string
  description: string
  projectType: string
  steps: WorkflowStep[]
  status: 'created' | 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

class WorkflowService {
  private readonly CACHE_PREFIX = 'workflow:'
  private readonly CACHE_TTL = 3600 // 1 hour
  
  async createWorkflow(
    userId: string,
    data: {
      name: string
      description: string
      userInput?: string
      projectType?: string
      phases?: any[]
    }
  ): Promise<Workflow> {
    try {
      // Call gRPC service to create workflow
      if (workflowClient) {
        return new Promise((resolve, reject) => {
          workflowClient.CreateWorkflow({
            user_input: data.userInput || data.description,
            session_id: `session_${Date.now()}`,
            user_id: userId,
            options: {
              project_type: data.projectType || 'web_application'
            }
          }, (error: any, response: any) => {
            if (error) {
              logger.error('gRPC CreateWorkflow error:', error)
              // Fall back to local creation
              return this.createLocalWorkflow(userId, data).then(resolve).catch(reject)
            }
            
            // Parse gRPC response and create workflow
            const workflow = this.parseGrpcWorkflow(response, userId)
            
            // Save to database
            this.saveWorkflow(workflow).then(() => {
              resolve(workflow)
            }).catch(reject)
          })
        })
      } else {
        // Fallback to local workflow creation
        return this.createLocalWorkflow(userId, data)
      }
    } catch (error) {
      logger.error('Error creating workflow:', error)
      throw new Error('Failed to create workflow')
    }
  }
  
  private async createLocalWorkflow(
    userId: string,
    data: {
      name: string
      description: string
      projectType?: string
      phases?: any[]
    }
  ): Promise<Workflow> {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Default steps based on project type
    const defaultSteps = this.getDefaultSteps(data.projectType || 'web_application')
    
    const workflow: Workflow = {
      id: workflowId,
      userId,
      name: data.name,
      description: data.description,
      projectType: data.projectType || 'web_application',
      steps: defaultSteps,
      status: 'created',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    }
    
    // Save to database
    await this.saveWorkflow(workflow)
    
    return workflow
  }
  
  private getDefaultSteps(projectType: string): WorkflowStep[] {
    const baseSteps: WorkflowStep[] = [
      {
        id: 'step_1',
        phase: 'brainstorming',
        name: 'Idea Refinement',
        description: 'Refine and validate the project idea',
        agents: ['idea_generator', 'architect'],
        status: 'pending'
      },
      {
        id: 'step_2',
        phase: 'requirements',
        name: 'Requirements Gathering',
        description: 'Gather and document detailed requirements',
        agents: ['architect', 'technical_writer'],
        status: 'pending'
      },
      {
        id: 'step_3',
        phase: 'architecture',
        name: 'System Design',
        description: 'Design system architecture and technical stack',
        agents: ['architect'],
        status: 'pending'
      },
      {
        id: 'step_4',
        phase: 'development',
        name: 'Implementation',
        description: 'Develop the solution',
        agents: ['code_scaffolder', 'python_backend', 'frontend_vue'],
        status: 'pending'
      },
      {
        id: 'step_5',
        phase: 'testing',
        name: 'Testing & QA',
        description: 'Test and validate the implementation',
        agents: ['testing_agent', 'code_reviewer'],
        status: 'pending'
      }
    ]
    
    // Add deployment step for certain project types
    if (['web_application', 'api_service'].includes(projectType)) {
      baseSteps.push({
        id: 'step_6',
        phase: 'deployment',
        name: 'Deployment',
        description: 'Deploy to production environment',
        agents: ['devops_engineer'],
        status: 'pending'
      })
    }
    
    return baseSteps
  }
  
  private parseGrpcWorkflow(grpcResponse: any, userId: string): Workflow {
    return {
      id: grpcResponse.workflow_id,
      userId,
      name: grpcResponse.name || 'New Workflow',
      description: grpcResponse.description || '',
      projectType: grpcResponse.project_type || 'web_application',
      steps: this.parseGrpcSteps(grpcResponse.phases || []),
      status: 'created',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: grpcResponse.metadata || {}
    }
  }
  
  private parseGrpcSteps(phases: any[]): WorkflowStep[] {
    return phases.map((phase: any, index: number) => ({
      id: `step_${index + 1}`,
      phase: phase.name,
      name: phase.title || phase.name,
      description: phase.description || '',
      agents: phase.agents || [],
      status: 'pending'
    }))
  }
  
  private async saveWorkflow(workflow: Workflow): Promise<void> {
    await query(
      `INSERT INTO workflows (id, user_id, name, description, config, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         config = EXCLUDED.config,
         updated_at = EXCLUDED.updated_at`,
      [
        workflow.id,
        workflow.userId,
        workflow.name,
        workflow.description,
        JSON.stringify({
          projectType: workflow.projectType,
          steps: workflow.steps,
          status: workflow.status,
          metadata: workflow.metadata
        }),
        true,
        workflow.createdAt,
        workflow.updatedAt
      ]
    )
    
    // Cache the workflow
    const cacheKey = `${this.CACHE_PREFIX}${workflow.id}`
    await getRedis().setex(cacheKey, this.CACHE_TTL, JSON.stringify(workflow))
  }
  
  async getWorkflow(workflowId: string, userId: string): Promise<Workflow | null> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${workflowId}`
      const cached = await getRedis().get(cacheKey)
      
      if (cached) {
        return JSON.parse(cached)
      }
      
      // Query database
      const result = await query(
        'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
        [workflowId, userId]
      )
      
      if (!result[0]) {
        return null
      }
      
      const workflow = this.dbRowToWorkflow(result[0])
      
      // Cache for future requests
      await getRedis().setex(cacheKey, this.CACHE_TTL, JSON.stringify(workflow))
      
      return workflow
    } catch (error) {
      logger.error('Error fetching workflow:', error)
      return null
    }
  }
  
  async getUserWorkflows(userId: string): Promise<Workflow[]> {
    try {
      const result = await query(
        'SELECT * FROM workflows WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      )
      
      return result.map(row => this.dbRowToWorkflow(row))
    } catch (error) {
      logger.error('Error fetching user workflows:', error)
      return []
    }
  }
  
  async executeWorkflow(workflowId: string, userId: string): Promise<any> {
    try {
      const workflow = await this.getWorkflow(workflowId, userId)
      if (!workflow) {
        throw new Error('Workflow not found')
      }
      
      // Update workflow status
      workflow.status = 'in_progress'
      await this.updateWorkflowStatus(workflowId, 'in_progress')
      
      // Emit status update event
      await workflowEvents.emitStatusUpdate(workflowId, userId, 'in_progress', {
        message: 'Workflow execution started'
      })
      
      // Call gRPC service to execute workflow
      if (workflowClient) {
        return new Promise((resolve, reject) => {
          const call = workflowClient.ExecuteWorkflow({
            workflow_id: workflowId,
            session_id: `session_${Date.now()}`,
            user_id: userId
          })
          
          // Handle streaming responses
          const updates: any[] = []
          
          call.on('data', (data: any) => {
            logger.info('Workflow update:', data)
            updates.push(data)
            
            // Update step status if provided
            if (data.step_id && data.status) {
              this.updateStepStatus(workflowId, data.step_id, data.status)
            }
          })
          
          call.on('end', () => {
            resolve({ success: true, updates })
          })
          
          call.on('error', (error: any) => {
            logger.error('Workflow execution error:', error)
            reject(error)
          })
        })
      } else {
        // Simulate execution locally
        return this.simulateWorkflowExecution(workflow)
      }
    } catch (error) {
      logger.error('Error executing workflow:', error)
      throw new Error('Failed to execute workflow')
    }
  }
  
  private async simulateWorkflowExecution(workflow: Workflow): Promise<any> {
    // Simulate step execution
    for (const step of workflow.steps) {
      step.status = 'in_progress'
      await this.updateStepStatus(workflow.id, step.id, 'in_progress')
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      step.status = 'completed'
      await this.updateStepStatus(workflow.id, step.id, 'completed')
    }
    
    // Update workflow status
    await this.updateWorkflowStatus(workflow.id, 'completed')
    
    return { success: true, message: 'Workflow executed successfully' }
  }
  
  async updateWorkflowStatus(workflowId: string, status: string, userId?: string): Promise<void> {
    await query(
      `UPDATE workflows 
       SET config = jsonb_set(config, '{status}', $1::jsonb),
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(status), workflowId]
    )
    
    // Emit status update event if userId is provided
    if (userId) {
      await workflowEvents.emitStatusUpdate(workflowId, userId, status)
    }
    
    // Invalidate cache
    const cacheKey = `${this.CACHE_PREFIX}${workflowId}`
    await getRedis().del(cacheKey)
  }
  
  async updateStepStatus(workflowId: string, stepId: string, status: string, userId?: string): Promise<void> {
    try {
      // Update the specific step status in the workflow config
      const result = await query(
        `UPDATE workflows 
         SET config = jsonb_set(
           config,
           '{steps}',
           (
             SELECT jsonb_agg(
               CASE 
                 WHEN step->>'id' = $1 
                 THEN jsonb_set(step, '{status}', $2::jsonb)
                 ELSE step
               END
             )
             FROM jsonb_array_elements(config->'steps') AS step
           )
         ),
         updated_at = NOW()
         WHERE id = $3
         RETURNING user_id`,
        [stepId, JSON.stringify(status), workflowId]
      )
      
      // Get userId if not provided
      const actualUserId = userId || result.rows[0]?.user_id
      
      if (actualUserId) {
        // Get step details from workflow
        const workflow = await this.getWorkflow(workflowId, actualUserId)
        const step = workflow?.steps.find(s => s.id === stepId)
        
        if (step) {
          // Emit appropriate event based on status
          if (status === 'in_progress') {
            await workflowEvents.emitStepStarted(workflowId, actualUserId, stepId, step.name)
          } else if (status === 'completed') {
            await workflowEvents.emitStepCompleted(workflowId, actualUserId, stepId, step.name)
          } else if (status === 'failed') {
            await workflowEvents.emitWorkflowError(workflowId, actualUserId, `Step ${step.name} failed`, stepId)
          }
        }
      }
      
      // Invalidate cache
      const cacheKey = `${this.CACHE_PREFIX}${workflowId}`
      await getRedis().del(cacheKey)
      
      logger.info(`Updated step ${stepId} in workflow ${workflowId} to status: ${status}`)
    } catch (error) {
      logger.error(`Failed to update step status: ${error}`)
      throw error
    }
  }
  
  async pauseWorkflow(workflowId: string, userId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'paused', userId)
    await workflowEvents.emitStatusUpdate(workflowId, userId, 'paused', {
      message: 'Workflow paused by user'
    })
  }
  
  async resumeWorkflow(workflowId: string, userId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'in_progress', userId)
    await workflowEvents.emitStatusUpdate(workflowId, userId, 'in_progress', {
      message: 'Workflow resumed by user'
    })
  }
  
  async cancelWorkflow(workflowId: string, userId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'cancelled', userId)
    await workflowEvents.emitStatusUpdate(workflowId, userId, 'cancelled', {
      message: 'Workflow cancelled by user'
    })
  }
  
  private dbRowToWorkflow(row: any): Workflow {
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config
    
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      projectType: config.projectType || 'web_application',
      steps: config.steps || [],
      status: config.status || 'created',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: config.metadata || {}
    }
  }
}

export const workflowService = new WorkflowService()