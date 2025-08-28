import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { query } from '../db/index.js'
import * as grpcService from '../services/grpc.js'
import { logger } from '../utils/logger.js'
import { PassThrough } from 'stream'

// Validation schema for streaming request
const streamRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(10000),
  options: z.object({
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).max(8192).optional(),
    model: z.string().optional()
  }).optional()
})

export const streamRoutes: FastifyPluginAsync = async (fastify) => {
  // SSE endpoint for streaming chat responses
  fastify.get('/chat/stream', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    
    try {
      // Parse and validate query parameters
      const params = streamRequestSchema.parse(request.query)
      
      // Verify session belongs to user
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [params.sessionId, user.id]
      )
      
      if (sessions.length === 0) {
        return reply.status(403).send({
          error: 'Session not found or access denied'
        })
      }
      
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
      })
      
      // Create message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Store user message
      await query(
        `INSERT INTO messages (session_id, sender, content, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [params.sessionId, 'user', params.message]
      )
      
      // Keep connection alive with periodic heartbeats
      const heartbeatInterval = setInterval(() => {
        reply.raw.write(':heartbeat\n\n')
      }, 30000) // Every 30 seconds
      
      // Handle client disconnect
      request.raw.on('close', () => {
        clearInterval(heartbeatInterval)
        logger.info(`SSE connection closed for session ${params.sessionId}`)
      })
      
      try {
        // Send initial event
        reply.raw.write(`event: start\n`)
        reply.raw.write(`data: ${JSON.stringify({
          messageId,
          sessionId: params.sessionId,
          timestamp: Date.now()
        })}\n\n`)
        
        // Stream from gRPC service
        const stream = await grpcService.streamChat({
          sessionId: params.sessionId,
          message: params.message,
          options: {
            stream: true,
            temperature: params.options?.temperature || 0.7,
            maxTokens: params.options?.maxTokens || 4096
          }
        })
        
        let accumulatedContent = ''
        let chunkCount = 0
        
        // Process stream chunks
        for await (const chunk of stream) {
          chunkCount++
          
          if (chunk.content) {
            accumulatedContent += chunk.content
            
            // Send chunk event
            reply.raw.write(`event: chunk\n`)
            reply.raw.write(`data: ${JSON.stringify({
              messageId,
              chunk: chunk.content,
              chunkIndex: chunkCount,
              timestamp: Date.now()
            })}\n\n`)
          }
          
          // Handle metadata
          if (chunk.metadata) {
            reply.raw.write(`event: metadata\n`)
            reply.raw.write(`data: ${JSON.stringify({
              messageId,
              metadata: chunk.metadata,
              timestamp: Date.now()
            })}\n\n`)
          }
          
          // Check if stream is complete
          if (chunk.is_final) {
            // Store AI response
            await query(
              `INSERT INTO messages (session_id, sender, content, metadata, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [params.sessionId, 'ai', accumulatedContent, chunk.metadata || {}]
            )
            
            // Send complete event
            reply.raw.write(`event: complete\n`)
            reply.raw.write(`data: ${JSON.stringify({
              messageId,
              content: accumulatedContent,
              totalChunks: chunkCount,
              widgets: chunk.widgets || [],
              metadata: chunk.metadata || {},
              timestamp: Date.now()
            })}\n\n`)
            
            break
          }
        }
        
      } catch (streamError: any) {
        logger.error('Stream error:', streamError)
        
        // Send error event
        reply.raw.write(`event: error\n`)
        reply.raw.write(`data: ${JSON.stringify({
          messageId,
          error: streamError.message || 'Stream processing failed',
          timestamp: Date.now()
        })}\n\n`)
      }
      
      // Clean up
      clearInterval(heartbeatInterval)
      reply.raw.end()
      
    } catch (error: any) {
      logger.error('SSE endpoint error:', error)
      
      if (!reply.sent) {
        return reply.status(400).send({
          error: error.message || 'Invalid request'
        })
      }
    }
  })
  
  // POST endpoint for initiating streaming with body parameters
  fastify.post('/chat/stream', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    
    try {
      const body = streamRequestSchema.parse(request.body)
      
      // Verify session
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [body.sessionId, user.id]
      )
      
      if (sessions.length === 0) {
        return reply.status(403).send({
          error: 'Session not found or access denied'
        })
      }
      
      // Create a PassThrough stream for the response
      const stream = new PassThrough()
      
      reply.type('text/event-stream')
      reply.header('Cache-Control', 'no-cache')
      reply.header('Connection', 'keep-alive')
      reply.send(stream)
      
      // Process streaming in background
      processStreamingChat(stream, body, user.id).catch(error => {
        logger.error('Background streaming error:', error)
        stream.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`)
        stream.end()
      })
      
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Invalid request'
      })
    }
  })
  
  // Cancel streaming endpoint
  fastify.post('/chat/stream/cancel', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = (request as any).user
    
    try {
      const { sessionId, messageId } = z.object({
        sessionId: z.string().uuid(),
        messageId: z.string()
      }).parse(request.body)
      
      // Verify session
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, user.id]
      )
      
      if (sessions.length === 0) {
        return reply.status(403).send({
          error: 'Session not found or access denied'
        })
      }
      
      // Cancel stream in gRPC service
      await grpcService.cancelStream(sessionId, messageId)
      
      logger.info(`Stream cancelled: ${messageId} in session ${sessionId}`)
      
      return reply.send({
        success: true,
        message: 'Stream cancelled'
      })
      
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Failed to cancel stream'
      })
    }
  })
}

// Background streaming processor
async function processStreamingChat(
  stream: PassThrough,
  params: z.infer<typeof streamRequestSchema>,
  userId: string
) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    // Store user message
    await query(
      `INSERT INTO messages (session_id, sender, content, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [params.sessionId, 'user', params.message]
    )
    
    // Send start event
    stream.write(`event: start\n`)
    stream.write(`data: ${JSON.stringify({ messageId, sessionId: params.sessionId })}\n\n`)
    
    // Get stream from gRPC
    const grpcStream = await grpcService.streamChat({
      sessionId: params.sessionId,
      message: params.message,
      options: params.options
    })
    
    let content = ''
    
    for await (const chunk of grpcStream) {
      if (chunk.content) {
        content += chunk.content
        stream.write(`event: chunk\n`)
        stream.write(`data: ${JSON.stringify({ 
          messageId, 
          chunk: chunk.content 
        })}\n\n`)
      }
      
      if (chunk.is_final) {
        // Store AI response
        await query(
          `INSERT INTO messages (session_id, sender, content, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [params.sessionId, 'ai', content]
        )
        
        stream.write(`event: complete\n`)
        stream.write(`data: ${JSON.stringify({ 
          messageId, 
          content,
          widgets: chunk.widgets || []
        })}\n\n`)
        
        break
      }
    }
    
  } catch (error: any) {
    stream.write(`event: error\n`)
    stream.write(`data: ${JSON.stringify({ 
      messageId, 
      error: error.message 
    })}\n\n`)
  } finally {
    stream.end()
  }
}