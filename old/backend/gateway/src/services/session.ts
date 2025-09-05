import { Pool } from 'pg'
// import { v4 as uuidv4 } from 'uuid'
const uuidv4 = () => `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
import { getSession, setSession, deleteSession } from './redis.js'
import { logger } from '../utils/logger.js'

export interface Session {
  id: string
  userId: string
  title: string
  status: 'active' | 'ended'
  createdAt: Date
  lastActivity: Date
  endedAt?: Date
  metadata?: Record<string, any>
}

export interface Message {
  id: string
  sessionId: string
  sender: 'user' | 'ai'
  content: string
  tokensUsed?: number
  processingTime?: number
  createdAt: Date
  metadata?: Record<string, any>
}

export class SessionManager {
  private db: Pool

  constructor(db: Pool) {
    this.db = db
  }

  async createSession(userId: string, title?: string): Promise<Session> {
    const sessionId = uuidv4()
    const sessionTitle = title || `Session ${new Date().toLocaleString()}`

    try {
      const result = await this.db.query(
        `INSERT INTO sessions (id, user_id, title, status, metadata) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, user_id, title, status, created_at, last_activity, metadata`,
        [sessionId, userId, sessionTitle, 'active', JSON.stringify({})]
      )

      const session = this.formatSession(result.rows[0])

      await setSession(`session:${sessionId}`, {
        id: sessionId,
        userId,
        title: sessionTitle,
        status: 'active',
        createdAt: session.createdAt
      })

      logger.info(`Session created: ${sessionId} for user: ${userId}`)
      return session
    } catch (error) {
      logger.error('Failed to create session:', error)
      throw new Error('Failed to create session')
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const cachedSession = await getSession(`session:${sessionId}`)
    if (cachedSession) {
      return cachedSession as Session
    }

    try {
      const result = await this.db.query(
        `SELECT id, user_id, title, status, created_at, last_activity, ended_at, metadata 
         FROM sessions 
         WHERE id = $1`,
        [sessionId]
      )

      if (result.rows.length === 0) {
        return null
      }

      const session = this.formatSession(result.rows[0])

      await setSession(`session:${sessionId}`, session, 3600)

      return session
    } catch (error) {
      logger.error('Failed to get session:', error)
      throw new Error('Failed to get session')
    }
  }

  async getUserSessions(userId: string, limit = 20): Promise<Session[]> {
    try {
      const result = await this.db.query(
        `SELECT id, user_id, title, status, created_at, last_activity, ended_at, metadata 
         FROM sessions 
         WHERE user_id = $1 
         ORDER BY last_activity DESC 
         LIMIT $2`,
        [userId, limit]
      )

      return result.rows.map(row => this.formatSession(row))
    } catch (error) {
      logger.error('Failed to get user sessions:', error)
      throw new Error('Failed to get user sessions')
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE sessions 
         SET last_activity = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [sessionId]
      )

      await deleteSession(`session:${sessionId}`)
    } catch (error) {
      logger.error('Failed to update session activity:', error)
      throw new Error('Failed to update session activity')
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE sessions 
         SET status = 'ended', ended_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [sessionId]
      )

      await deleteSession(`session:${sessionId}`)
      logger.info(`Session ended: ${sessionId}`)
    } catch (error) {
      logger.error('Failed to end session:', error)
      throw new Error('Failed to end session')
    }
  }

  async addMessage(
    sessionId: string,
    sender: 'user' | 'ai',
    content: string,
    metadata?: Record<string, any>
  ): Promise<Message> {
    const messageId = uuidv4()

    try {
      await this.updateSessionActivity(sessionId)

      const result = await this.db.query(
        `INSERT INTO messages (id, session_id, sender, content, metadata) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, session_id, sender, content, tokens_used, processing_time, created_at, metadata`,
        [messageId, sessionId, sender, content, JSON.stringify(metadata || {})]
      )

      const message = this.formatMessage(result.rows[0])
      logger.info(`Message added to session ${sessionId}: ${messageId}`)
      return message
    } catch (error) {
      logger.error('Failed to add message:', error)
      throw new Error('Failed to add message')
    }
  }

  async getSessionMessages(sessionId: string, limit = 50): Promise<Message[]> {
    try {
      const result = await this.db.query(
        `SELECT id, session_id, sender, content, tokens_used, processing_time, created_at, metadata 
         FROM messages 
         WHERE session_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [sessionId, limit]
      )

      return result.rows.map(row => this.formatMessage(row)).reverse()
    } catch (error) {
      logger.error('Failed to get session messages:', error)
      throw new Error('Failed to get session messages')
    }
  }

  async updateMessageMetrics(
    messageId: string,
    tokensUsed: number,
    processingTime: number
  ): Promise<void> {
    try {
      await this.db.query(
        `UPDATE messages 
         SET tokens_used = $1, processing_time = $2 
         WHERE id = $3`,
        [tokensUsed, processingTime, messageId]
      )
    } catch (error) {
      logger.error('Failed to update message metrics:', error)
      throw new Error('Failed to update message metrics')
    }
  }

  async validateSessionAccess(sessionId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT id FROM sessions 
         WHERE id = $1 AND user_id = $2 AND status = 'active'`,
        [sessionId, userId]
      )

      return result.rows.length > 0
    } catch (error) {
      logger.error('Failed to validate session access:', error)
      return false
    }
  }

  async getSessionStats(userId: string): Promise<{
    totalSessions: number
    activeSessions: number
    totalMessages: number
    totalTokensUsed: number
  }> {
    try {
      const sessionStats = await this.db.query(
        `SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions
         FROM sessions 
         WHERE user_id = $1`,
        [userId]
      )

      const messageStats = await this.db.query(
        `SELECT 
          COUNT(m.*) as total_messages,
          COALESCE(SUM(m.tokens_used), 0) as total_tokens_used
         FROM messages m
         JOIN sessions s ON m.session_id = s.id
         WHERE s.user_id = $1`,
        [userId]
      )

      return {
        totalSessions: parseInt(sessionStats.rows[0].total_sessions),
        activeSessions: parseInt(sessionStats.rows[0].active_sessions),
        totalMessages: parseInt(messageStats.rows[0].total_messages),
        totalTokensUsed: parseInt(messageStats.rows[0].total_tokens_used)
      }
    } catch (error) {
      logger.error('Failed to get session stats:', error)
      throw new Error('Failed to get session stats')
    }
  }

  private formatSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      status: row.status,
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      metadata: row.metadata
    }
  }

  private formatMessage(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      sender: row.sender,
      content: row.content,
      tokensUsed: row.tokens_used,
      processingTime: row.processing_time,
      createdAt: new Date(row.created_at),
      metadata: row.metadata
    }
  }
}

export function createSessionManager(db: Pool): SessionManager {
  return new SessionManager(db)
}