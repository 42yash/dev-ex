import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireApiKey, requireApiKeyWithPermissions, getApiKeyAuth, Permissions } from '../middleware/apiKeyAuth.js'
import { chatService } from '../services/chat.js'
import { workflowService } from '../services/workflow.js'
import { logger } from '../utils/logger.js'

// Validation schemas
const apiChatSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  stream: z.boolean().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(100).max(4096).optional()
})

const apiWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  phases: z.array(z.object({
    name: z.string(),
    agents: z.array(z.string())
  }))
})

/**
 * External API routes for programmatic access
 * All routes require API key authentication
 */
export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Chat completion endpoint - requires 'read' permission
  fastify.post('/chat/completions', {
    preHandler: [requireApiKey(Permissions.READ)]
  }, async (request, reply) => {
    try {
      const auth = getApiKeyAuth(request)
      const body = apiChatSchema.parse(request.body)
      
      // Use API key's user context
      const userId = auth?.userId
      if (!userId) {
        return reply.status(401).send({
          error: 'Invalid authentication context'
        })
      }
      
      // Create or get session
      let sessionId = body.sessionId
      if (!sessionId) {
        const session = await chatService.createSession(userId, {
          title: 'API Chat Session',
          metadata: { source: 'api' }
        })
        sessionId = session.id
      }
      
      // Send message
      const response = await chatService.sendMessage(userId, sessionId, {
        message: body.message,
        stream: body.stream || false,
        model: body.model,
        temperature: body.temperature,
        maxTokens: body.maxTokens
      })
      
      logger.info({
        userId,
        sessionId,
        apiKey: true,
        event: 'api_chat_completion'
      }, 'API chat completion request')
      
      return reply.send({
        success: true,
        sessionId,
        response
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      logger.error({ error }, 'API chat completion error')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process chat completion'
      })
    }
  })
  
  // List sessions - requires 'read' permission
  fastify.get('/sessions', {
    preHandler: [requireApiKey(Permissions.READ)]
  }, async (request, reply) => {
    try {
      const auth = getApiKeyAuth(request)
      const userId = auth?.userId
      
      if (!userId) {
        return reply.status(401).send({
          error: 'Invalid authentication context'
        })
      }
      
      const sessions = await chatService.getUserSessions(userId)
      
      return reply.send({
        success: true,
        sessions
      })
    } catch (error) {
      logger.error({ error }, 'API list sessions error')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list sessions'
      })
    }
  })
  
  // Create workflow - requires 'write' and 'manage_workflows' permissions
  fastify.post('/workflows', {
    preHandler: [requireApiKeyWithPermissions(Permissions.WRITE, Permissions.MANAGE_WORKFLOWS)]
  }, async (request, reply) => {
    try {
      const auth = getApiKeyAuth(request)
      const body = apiWorkflowSchema.parse(request.body)
      const userId = auth?.userId
      
      if (!userId) {
        return reply.status(401).send({
          error: 'Invalid authentication context'
        })
      }
      
      const workflow = await workflowService.createWorkflow(userId, body)
      
      logger.info({
        userId,
        workflowId: workflow.id,
        apiKey: true,
        event: 'api_workflow_created'
      }, 'API workflow created')
      
      return reply.send({
        success: true,
        workflow
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      logger.error({ error }, 'API create workflow error')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create workflow'
      })
    }
  })
  
  // Execute workflow - requires 'execute' permission
  fastify.post('/workflows/:workflowId/execute', {
    preHandler: [requireApiKey(Permissions.EXECUTE)]
  }, async (request, reply) => {
    try {
      const auth = getApiKeyAuth(request)
      const { workflowId } = request.params as { workflowId: string }
      const userId = auth?.userId
      
      if (!userId) {
        return reply.status(401).send({
          error: 'Invalid authentication context'
        })
      }
      
      // Validate workflow exists and user has access
      const workflow = await workflowService.getWorkflow(workflowId, userId)
      if (!workflow) {
        return reply.status(404).send({
          error: 'Workflow not found'
        })
      }
      
      // Execute workflow
      const execution = await workflowService.executeWorkflow(workflowId, userId)
      
      logger.info({
        userId,
        workflowId,
        executionId: execution.id,
        apiKey: true,
        event: 'api_workflow_executed'
      }, 'API workflow executed')
      
      return reply.send({
        success: true,
        execution
      })
    } catch (error) {
      logger.error({ error }, 'API execute workflow error')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to execute workflow'
      })
    }
  })
  
  // Get API usage stats - requires 'view_analytics' permission
  fastify.get('/stats/usage', {
    preHandler: [requireApiKey(Permissions.VIEW_ANALYTICS)]
  }, async (request, reply) => {
    try {
      const auth = getApiKeyAuth(request)
      const userId = auth?.userId
      
      if (!userId) {
        return reply.status(401).send({
          error: 'Invalid authentication context'
        })
      }
      
      // Get usage stats (placeholder - implement actual stats)
      const stats = {
        requests: {
          total: 1234,
          today: 45,
          thisMonth: 890
        },
        tokens: {
          used: 45678,
          limit: 100000,
          remaining: 54322
        },
        sessions: {
          total: 23,
          active: 3
        },
        workflows: {
          created: 5,
          executed: 12
        }
      }
      
      return reply.send({
        success: true,
        stats
      })
    } catch (error) {
      logger.error({ error }, 'API get stats error')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get usage stats'
      })
    }
  })
  
  // Health check endpoint - no authentication required
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    })
  })
}

export default apiRoutes