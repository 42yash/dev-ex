import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { workflowService } from '../services/workflow.js'
import { workflowEvents } from '../services/workflowEvents.js'
import { logger } from '../utils/logger.js'
import { authMiddleware } from '../middleware/auth.js'

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  userInput: z.string().optional(),
  projectType: z.enum(['web_application', 'api_service', 'documentation', 'cli_tool', 'microservice']).optional(),
  phases: z.array(z.object({
    name: z.string(),
    agents: z.array(z.string())
  })).optional()
})

const workflowIdSchema = z.object({
  workflowId: z.string()
})

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Create a new workflow
  fastify.post('/workflows', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const body = createWorkflowSchema.parse(request.body)
      
      const workflow = await workflowService.createWorkflow(user.id, body)
      
      logger.info({
        userId: user.id,
        workflowId: workflow.id,
        event: 'workflow_created'
      }, 'Workflow created')
      
      return reply.send({
        success: true,
        workflow
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
      }
      logger.error('Error creating workflow:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create workflow'
      })
    }
  })
  
  // Get user's workflows
  fastify.get('/workflows', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      
      const workflows = await workflowService.getUserWorkflows(user.id)
      
      return reply.send({
        success: true,
        workflows
      })
    } catch (error) {
      logger.error('Error fetching workflows:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch workflows'
      })
    }
  })
  
  // Get specific workflow
  fastify.get('/workflows/:workflowId', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { workflowId } = workflowIdSchema.parse(request.params)
      
      const workflow = await workflowService.getWorkflow(workflowId, user.id)
      
      if (!workflow) {
        return reply.status(404).send({
          success: false,
          error: 'Workflow not found'
        })
      }
      
      return reply.send({
        success: true,
        workflow
      })
    } catch (error) {
      logger.error('Error fetching workflow:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch workflow'
      })
    }
  })
  
  // Execute workflow
  fastify.post('/workflows/:workflowId/execute', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { workflowId } = workflowIdSchema.parse(request.params)
      
      const result = await workflowService.executeWorkflow(workflowId, user.id)
      
      logger.info({
        userId: user.id,
        workflowId,
        event: 'workflow_executed'
      }, 'Workflow executed')
      
      return reply.send({
        success: true,
        result
      })
    } catch (error) {
      logger.error('Error executing workflow:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to execute workflow'
      })
    }
  })
  
  // Pause workflow
  fastify.post('/workflows/:workflowId/pause', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { workflowId } = workflowIdSchema.parse(request.params)
      
      await workflowService.pauseWorkflow(workflowId, user.id)
      
      logger.info({
        userId: user.id,
        workflowId,
        event: 'workflow_paused'
      }, 'Workflow paused')
      
      return reply.send({
        success: true,
        message: 'Workflow paused'
      })
    } catch (error) {
      logger.error('Error pausing workflow:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to pause workflow'
      })
    }
  })
  
  // Resume workflow
  fastify.post('/workflows/:workflowId/resume', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { workflowId } = workflowIdSchema.parse(request.params)
      
      await workflowService.resumeWorkflow(workflowId, user.id)
      
      logger.info({
        userId: user.id,
        workflowId,
        event: 'workflow_resumed'
      }, 'Workflow resumed')
      
      return reply.send({
        success: true,
        message: 'Workflow resumed'
      })
    } catch (error) {
      logger.error('Error resuming workflow:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to resume workflow'
      })
    }
  })
  
  // Cancel workflow
  fastify.post('/workflows/:workflowId/cancel', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { workflowId } = workflowIdSchema.parse(request.params)
      
      await workflowService.cancelWorkflow(workflowId, user.id)
      
      logger.info({
        userId: user.id,
        workflowId,
        event: 'workflow_cancelled'
      }, 'Workflow cancelled')
      
      return reply.send({
        success: true,
        message: 'Workflow cancelled'
      })
    } catch (error) {
      logger.error('Error cancelling workflow:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to cancel workflow'
      })
    }
  })
  
  // Stream workflow updates (Server-Sent Events)
  fastify.get('/workflows/:workflowId/stream', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const user = (request as any).user
    const { workflowId } = workflowIdSchema.parse(request.params)
    
    // Verify user owns this workflow
    const workflow = await workflowService.getWorkflow(workflowId, user.id)
    if (!workflow) {
      return reply.status(404).send({
        success: false,
        error: 'Workflow not found'
      })
    }
    
    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    })
    
    // Send initial connection message with current workflow state
    reply.raw.write(`data: ${JSON.stringify({ 
      type: 'connected', 
      workflowId,
      workflow 
    })}\n\n`)
    
    // Subscribe to workflow events
    await workflowEvents.subscribeToWorkflow(workflowId, user.id)
    
    // Set up event listener for this workflow
    const channel = `workflow:${workflowId}`
    const eventHandler = async (event: any) => {
      try {
        // Fetch updated workflow data
        const updatedWorkflow = await workflowService.getWorkflow(workflowId, user.id)
        
        // Send update to client
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'update',
          event: event.type,
          workflow: updatedWorkflow,
          eventData: event.data,
          timestamp: event.timestamp
        })}\n\n`)
        
        // If workflow is complete, close the connection after a delay
        if (['completed', 'failed', 'cancelled'].includes(updatedWorkflow?.status || '')) {
          setTimeout(() => {
            reply.raw.write(`data: ${JSON.stringify({ 
              type: 'complete',
              workflowId
            })}\n\n`)
            reply.raw.end()
          }, 1000)
        }
      } catch (error) {
        logger.error('Error sending workflow update:', error)
        reply.raw.write(`data: ${JSON.stringify({ 
          type: 'error',
          error: 'Failed to send update'
        })}\n\n`)
      }
    }
    
    // Attach event listener
    workflowEvents.on(channel, eventHandler)
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat\n\n`)
    }, 30000)
    
    // Clean up on client disconnect
    request.raw.on('close', async () => {
      clearInterval(heartbeat)
      workflowEvents.off(channel, eventHandler)
      await workflowEvents.unsubscribeFromWorkflow(workflowId)
      reply.raw.end()
    })
  })
}

export default workflowRoutes