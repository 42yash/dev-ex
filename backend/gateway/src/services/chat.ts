import { query } from '../db/index.js'
import { getCached, setCached } from './redis.js'
import * as grpcService from './grpc.js'
import { logger } from '../utils/logger.js'
import { v4 as uuidv4 } from 'uuid'

export interface ChatSession {
  id: string
  userId: string
  title: string
  metadata: Record<string, any>
  status: string
  createdAt: Date
  lastActivity: Date
}

export interface ChatMessage {
  id: string
  sessionId: string
  sender: 'user' | 'ai'
  content: string
  tokensUsed?: number
  processingTime?: number
  createdAt: Date
}

export interface SendMessageOptions {
  message: string
  stream?: boolean
  model?: string
  temperature?: number
  maxTokens?: number
}

class ChatService {
  /**
   * Create a new chat session for a user
   */
  async createSession(
    userId: string,
    options: { title?: string; metadata?: Record<string, any> } = {}
  ): Promise<ChatSession> {
    try {
      const sessionId = uuidv4()
      const title = options.title || 'New Chat Session'
      const metadata = options.metadata || {}
      
      // Create session in database
      const result = await query(
        `INSERT INTO sessions (id, user_id, title, metadata, status) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, user_id, title, metadata, status, created_at, last_activity`,
        [sessionId, userId, title, metadata, 'active']
      )
      
      const session = result[0]
      
      // Try to create session in AI service
      try {
        await grpcService.createSession(userId, { sessionId })
      } catch (error) {
        logger.warn('Failed to create session in AI service:', error)
        // Continue anyway - AI service might not be available
      }
      
      // Cache session
      await setCached(`session:${sessionId}`, session, 86400)
      
      logger.info(`Chat session created: ${sessionId} for user: ${userId}`)
      
      return {
        id: session.id,
        userId: session.user_id,
        title: session.title,
        metadata: session.metadata,
        status: session.status,
        createdAt: session.created_at,
        lastActivity: session.last_activity
      }
    } catch (error) {
      logger.error('Failed to create chat session:', error)
      throw new Error('Failed to create chat session')
    }
  }
  
  /**
   * Send a message in a chat session
   */
  async sendMessage(
    userId: string,
    sessionId: string,
    options: SendMessageOptions
  ): Promise<any> {
    try {
      // Verify session belongs to user
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      )
      
      if (sessions.length === 0) {
        throw new Error('Session not found or access denied')
      }
      
      // Store user message in database
      const userMessageResult = await query(
        `INSERT INTO messages (session_id, sender, content) 
         VALUES ($1, $2, $3)
         RETURNING id, session_id, sender, content, created_at`,
        [sessionId, 'user', options.message]
      )
      
      const userMessage = userMessageResult[0]
      
      // Update session last activity
      await query(
        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [sessionId]
      )
      
      // Try to send to AI service
      let aiResponse = null
      try {
        aiResponse = await grpcService.sendMessage(
          sessionId,
          options.message,
          {
            stream: options.stream,
            preferredConnector: options.model,
            maxTokens: options.maxTokens,
            temperature: options.temperature
          }
        )
        
        // Store AI response in database
        await query(
          `INSERT INTO messages (session_id, sender, content, tokens_used, processing_time) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sessionId,
            'ai',
            aiResponse.content,
            aiResponse.metadata?.tokens_used || null,
            aiResponse.metadata?.processing_time || null
          ]
        )
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
        await query(
          `INSERT INTO messages (session_id, sender, content) 
           VALUES ($1, $2, $3)`,
          [sessionId, 'ai', aiResponse.content]
        )
      }
      
      return {
        sessionId,
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          timestamp: userMessage.created_at
        },
        aiResponse
      }
    } catch (error) {
      logger.error('Failed to send message:', error)
      throw error
    }
  }
  
  /**
   * Get all chat sessions for a user
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    try {
      // Check cache first
      const cacheKey = `user_sessions:${userId}`
      const cached = await getCached(cacheKey)
      if (cached) {
        return cached
      }
      
      // Get sessions from database
      const sessions = await query(
        `SELECT id, user_id, title, metadata, status, created_at, last_activity 
         FROM sessions 
         WHERE user_id = $1 
         ORDER BY last_activity DESC 
         LIMIT 50`,
        [userId]
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
      
      const formattedSessions = sessions.map((s: any) => ({
        id: s.id,
        userId: s.user_id,
        title: s.title,
        metadata: s.metadata,
        status: s.status,
        createdAt: s.created_at,
        lastActivity: s.last_activity,
        messageCount: s.messageCount || 0
      }))
      
      // Cache for 5 minutes
      await setCached(cacheKey, formattedSessions, 300)
      
      return formattedSessions
    } catch (error) {
      logger.error('Failed to get user sessions:', error)
      throw new Error('Failed to get user sessions')
    }
  }
  
  /**
   * Get chat history for a session
   */
  async getSessionHistory(
    userId: string,
    sessionId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: ChatMessage[]; totalCount: number }> {
    try {
      // Verify session belongs to user
      const sessions = await query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      )
      
      if (sessions.length === 0) {
        throw new Error('Session not found or access denied')
      }
      
      // Check cache first
      const cacheKey = `history:${sessionId}:${limit}:${offset}`
      const cached = await getCached(cacheKey)
      if (cached) {
        return cached
      }
      
      // Get messages from database
      const messages = await query(
        `SELECT id, session_id, sender, content, tokens_used, processing_time, created_at
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
      
      const formattedMessages = messages.reverse().map((m: any) => ({
        id: m.id,
        sessionId: m.session_id,
        sender: m.sender,
        content: m.content,
        tokensUsed: m.tokens_used,
        processingTime: m.processing_time,
        createdAt: m.created_at
      }))
      
      const response = {
        messages: formattedMessages,
        totalCount: parseInt(countResult[0].total)
      }
      
      // Cache for 5 minutes
      await setCached(cacheKey, response, 300)
      
      return response
    } catch (error) {
      logger.error('Failed to get session history:', error)
      throw error
    }
  }
  
  /**
   * Delete a chat session
   */
  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // Verify session belongs to user and delete
      const result = await query(
        'DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id',
        [sessionId, userId]
      )
      
      if (result.length === 0) {
        throw new Error('Session not found or access denied')
      }
      
      // Clear cache
      await setCached(`session:${sessionId}`, null, 1)
      await setCached(`user_sessions:${userId}`, null, 1)
      
      logger.info(`Session deleted: ${sessionId} by user: ${userId}`)
      
      return true
    } catch (error) {
      logger.error('Failed to delete session:', error)
      throw error
    }
  }
}

export const chatService = new ChatService()