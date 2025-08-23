import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { query } from '../db/index.js'
import { getCached, setCached } from '../services/redis.js'
import * as grpcService from '../services/grpc.js'
import { logger } from '../utils/logger.js'
import { broadcastMessage } from '../services/websocket.js'

// Validation schemas
const sendMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(10000),
  options: z.object({
    stream: z.boolean().optional(),
    preferredConnector: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().min(0).max(1).optional()
  }).optional()
})

const createSessionSchema = z.object({
  title: z.string().optional(),
  metadata: z.record(z.string()).optional()
})

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new chat session
  fastify.post('/session', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const body = createSessionSchema.parse(request.body)
      
      // Create session in database
      const result = await query(
        `INSERT INTO sessions (user_id, title, metadata) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_id, title, status, created_at`,
        [user.id, body.title || 'New Chat', body.metadata || {}]
      )
      
      const session = result[0]
      
      // Try to create session in AI service (if available)
      try {
        await grpcService.createSession(user.id, { sessionId: session.id })
      } catch (error) {
        logger.warn('Failed to create session in AI service:', error)
        // Continue anyway - AI service might not be running in dev
      }
      
      // Cache session
      await setCached(`session:${session.id}`, session, 86400)
      
      logger.info(`Session created: ${session.id} for user: ${user.email}`)
      
      return reply.send({
        session
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Send a message
  fastify.post('/message', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const body = sendMessageSchema.parse(request.body)
      
      let sessionId = body.sessionId
      
      // Create session if not provided
      if (!sessionId) {
        const result = await query(
          `INSERT INTO sessions (user_id, title) 
           VALUES ($1, $2) 
           RETURNING id`,
          [user.id, 'New Chat']
        )
        sessionId = result[0].id
      }
      
      // Verify session belongs to user
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, user.id]
      )
      
      if (sessions.length === 0) {
        return reply.status(403).send({
          error: 'Session not found or access denied'
        })
      }
      
      // Store user message in database
      const userMessageResult = await query(
        `INSERT INTO messages (session_id, sender, content) 
         VALUES ($1, $2, $3)
         RETURNING id, session_id, sender, content, created_at`,
        [sessionId, 'user', body.message]
      )
      
      const userMessage = userMessageResult[0]
      
      // Broadcast user message via WebSocket
      const io = (fastify as any).io
      if (io && sessionId) {
        logger.info(`Broadcasting message to session ${sessionId}`)
        broadcastMessage(io, sessionId, {
          id: userMessage.id,
          sessionId: userMessage.session_id,
          sender: userMessage.sender,
          content: userMessage.content,
          timestamp: userMessage.created_at
        })
      } else {
        logger.warn(`WebSocket not available for broadcasting (io: ${!!io}, sessionId: ${sessionId})`)
      }
      
      // Update session last activity
      await query(
        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [sessionId]
      )
      
      // Try to send to AI service
      let aiResponse = null
      try {
        aiResponse = await grpcService.sendMessage(
          sessionId!,
          body.message,
          body.options
        )
        
        // Store AI response in database
        const aiMessageResult = await query(
          `INSERT INTO messages (session_id, sender, content, tokens_used, processing_time) 
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, session_id, sender, content, created_at`,
          [
            sessionId,
            'ai',
            aiResponse.content,
            aiResponse.metadata?.tokens_used || null,
            aiResponse.metadata?.processing_time || null
          ]
        )
        
        const aiMessage = aiMessageResult[0]
        
        // Broadcast AI response via WebSocket
        if (io && sessionId) {
          broadcastMessage(io, sessionId, {
            id: aiMessage.id,
            sessionId: aiMessage.session_id,
            sender: aiMessage.sender,
            content: aiMessage.content,
            timestamp: aiMessage.created_at,
            widgets: aiResponse.widgets,
            metadata: aiResponse.metadata
          })
        }
      } catch (error) {
        logger.error('Failed to get AI response:', error)
        
        // Fallback response when AI service is not available
        aiResponse = {
          response_id: `fallback-${Date.now()}`,
          content: "I'm currently unable to process your request. The AI service is being configured. Please try again later.",
          widgets: [],
          suggested_actions: [],
          metadata: {}
        }
        
        // Store fallback response
        const fallbackResult = await query(
          `INSERT INTO messages (session_id, sender, content) 
           VALUES ($1, $2, $3)
           RETURNING id, session_id, sender, content, created_at`,
          [sessionId, 'ai', aiResponse.content]
        )
        
        const fallbackMessage = fallbackResult[0]
        
        // Broadcast fallback response via WebSocket
        if (io && sessionId) {
          broadcastMessage(io, sessionId, {
            id: fallbackMessage.id,
            sessionId: fallbackMessage.session_id,
            sender: fallbackMessage.sender,
            content: fallbackMessage.content,
            timestamp: fallbackMessage.created_at
          })
        }
      }
      
      return reply.send({
        sessionId,
        response: aiResponse
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
  
  // Get chat history
  fastify.get('/history/:sessionId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { sessionId } = request.params as { sessionId: string }
      const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }
      
      // Verify session belongs to user
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, user.id]
      )
      
      if (sessions.length === 0) {
        return reply.status(403).send({
          error: 'Session not found or access denied'
        })
      }
      
      // Check cache first
      const cacheKey = `history:${sessionId}:${limit}:${offset}`
      const cached = await getCached(cacheKey)
      if (cached) {
        return reply.send(cached)
      }
      
      // Get messages from database
      const messages = await query(
        `SELECT id as message_id, session_id, sender, content, created_at as timestamp
         FROM messages 
         WHERE session_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [sessionId, limit, offset]
      )
      
      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) as total FROM messages WHERE session_id = $1',
        [sessionId]
      )
      
      const response = {
        messages: messages.reverse(), // Reverse to get chronological order
        totalCount: parseInt(countResult[0].total)
      }
      
      // Cache for 5 minutes
      await setCached(cacheKey, response, 300)
      
      return reply.send(response)
    } catch (error) {
      throw error
    }
  })
  
  // Get user's sessions
  fastify.get('/sessions', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { limit = 20, offset = 0 } = request.query as { limit?: number; offset?: number }
      
      const sessions = await query(
        `SELECT id, title, status, created_at, last_activity 
         FROM sessions 
         WHERE user_id = $1 
         ORDER BY last_activity DESC 
         LIMIT $2 OFFSET $3`,
        [user.id, limit, offset]
      )
      
      // Get message count for each session
      const sessionIds = sessions.map((s: any) => s.id)
      if (sessionIds.length > 0) {
        const messageCounts = await query(
          `SELECT session_id, COUNT(*) as message_count 
           FROM messages 
           WHERE session_id = ANY($1) 
           GROUP BY session_id`,
          [sessionIds]
        )
        
        const countMap = new Map(
          messageCounts.map((c: any) => [c.session_id, parseInt(c.message_count)])
        )
        
        sessions.forEach((s: any) => {
          s.messageCount = countMap.get(s.id) || 0
        })
      }
      
      return reply.send({
        sessions
      })
    } catch (error) {
      throw error
    }
  })
  
  // Delete a session
  fastify.delete('/session/:sessionId', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user
      const { sessionId } = request.params as { sessionId: string }
      
      // Verify session belongs to user and delete
      const result = await query(
        'DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id',
        [sessionId, user.id]
      )
      
      if (result.length === 0) {
        return reply.status(404).send({
          error: 'Session not found or access denied'
        })
      }
      
      // Clear cache
      await setCached(`session:${sessionId}`, null, 1)
      
      logger.info(`Session deleted: ${sessionId} by user: ${user.email}`)
      
      return reply.send({
        message: 'Session deleted successfully'
      })
    } catch (error) {
      throw error
    }
  })
}