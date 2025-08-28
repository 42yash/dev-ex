import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger.js'
import { query } from '../db/index.js'

export function setupWebSocket(server: HTTPServer, _fastify: any): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    },
    transports: ['websocket', 'polling']
  })

  // Authentication middleware
  io.use(async (socket: any, next) => {
    let token: string | undefined
    try {
      token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1]
      
      if (!token) {
        logger.error('WebSocket authentication failed: No token provided')
        return next(new Error('Authentication required'))
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
      
      // Attach user info to socket
      socket.userId = decoded.id
      socket.email = decoded.email
      
      logger.info(`WebSocket authenticated: ${decoded.email}`)
      next()
    } catch (error: any) {
      logger.error('WebSocket authentication failed:', { 
        message: error?.message, 
        error: error?.toString(),
        token: token ? 'provided' : 'missing',
        secret: process.env.JWT_SECRET ? 'set' : 'using default'
      })
      next(new Error('Invalid token'))
    }
  })

  // Connection handler
  io.on('connection', (socket: any) => {
    logger.info(`User connected: ${socket.email} (${socket.id})`)
    
    // Join user's personal room
    socket.join(`user:${socket.userId}`)
    
    // Session room management
    socket.on('join_session', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data
        
        // Verify user has access to this session
        const sessions = await query(
          'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
          [sessionId, socket.userId]
        )
        
        if (sessions.length === 0) {
          socket.emit('error', { message: 'Session not found or access denied' })
          return
        }
        
        // Join session room
        socket.join(`session:${sessionId}`)
        socket.emit('joined_session', { sessionId })
        
        logger.info(`User ${socket.email} joined session: ${sessionId}`)
      } catch (error) {
        logger.error('Error joining session:', error)
        socket.emit('error', { message: 'Failed to join session' })
      }
    })
    
    socket.on('leave_session', (data: { sessionId: string }) => {
      const { sessionId } = data
      socket.leave(`session:${sessionId}`)
      socket.emit('left_session', { sessionId })
      
      logger.info(`User ${socket.email} left session: ${sessionId}`)
    })
    
    // Handle typing indicators
    socket.on('typing_start', (data: { sessionId: string }) => {
      socket.to(`session:${data.sessionId}`).emit('user_typing', {
        userId: socket.userId,
        email: socket.email
      })
    })
    
    socket.on('typing_stop', (data: { sessionId: string }) => {
      socket.to(`session:${data.sessionId}`).emit('user_stopped_typing', {
        userId: socket.userId
      })
    })
    
    // Handle stream control
    socket.on('stream_control', async (data: { 
      action: 'cancel' | 'pause' | 'resume',
      sessionId: string,
      messageId: string 
    }) => {
      try {
        const { action, sessionId, messageId } = data
        
        // Verify user has access to this session
        const sessions = await query(
          'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
          [sessionId, socket.userId]
        )
        
        if (sessions.length === 0) {
          socket.emit('error', { message: 'Session not found or access denied' })
          return
        }
        
        // Emit control event to all listeners
        io.to(`session:${sessionId}`).emit('stream_control_event', {
          action,
          sessionId,
          messageId,
          userId: socket.userId
        })
        
        logger.info(`Stream control: ${action} for message ${messageId} in session ${sessionId}`)
      } catch (error) {
        logger.error('Error handling stream control:', error)
        socket.emit('error', { message: 'Failed to control stream' })
      }
    })
    
    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.email} (${socket.id})`)
    })
  })

  return io
}

// Helper function to emit events to specific sessions
export function emitToSession(io: SocketIOServer, sessionId: string, event: string, data: any) {
  io.to(`session:${sessionId}`).emit(event, data)
}

// Helper function to emit events to specific users
export function emitToUser(io: SocketIOServer, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data)
}

// Helper function to broadcast new messages
export function broadcastMessage(
  io: SocketIOServer,
  sessionId: string,
  message: {
    id: string
    sessionId: string
    sender: 'user' | 'ai'
    content: string
    timestamp: string
    widgets?: any[]
    metadata?: any
  }
) {
  emitToSession(io, sessionId, 'chat_message', {
    sessionId,
    message
  })
}

// Helper function for streaming AI responses
export function streamMessage(
  io: SocketIOServer,
  sessionId: string,
  messageId: string,
  chunk: string,
  isComplete: boolean = false,
  metadata?: {
    tokens?: number
    model?: string
    latency?: number
    firstTokenLatency?: number
  }
) {
  emitToSession(io, sessionId, 'message_stream', {
    sessionId,
    messageId,
    chunk,
    isComplete,
    metadata,
    timestamp: Date.now()
  })
}

// Enhanced streaming functions for token-by-token updates
export interface StreamingEvent {
  type: 'stream.start' | 'stream.chunk' | 'stream.end' | 'stream.error' | 'stream.heartbeat'
  sessionId: string
  messageId: string
  chunk?: string
  metadata?: Record<string, any>
  error?: string
  timestamp: number
}

export function emitStreamEvent(
  io: SocketIOServer,
  event: StreamingEvent
) {
  emitToSession(io, event.sessionId, 'stream_event', event)
}

export function startStream(
  io: SocketIOServer,
  sessionId: string,
  messageId: string,
  metadata?: Record<string, any>
) {
  emitStreamEvent(io, {
    type: 'stream.start',
    sessionId,
    messageId,
    metadata,
    timestamp: Date.now()
  })
}

export function streamChunk(
  io: SocketIOServer,
  sessionId: string,
  messageId: string,
  chunk: string,
  metadata?: Record<string, any>
) {
  emitStreamEvent(io, {
    type: 'stream.chunk',
    sessionId,
    messageId,
    chunk,
    metadata,
    timestamp: Date.now()
  })
}

export function endStream(
  io: SocketIOServer,
  sessionId: string,
  messageId: string,
  metadata?: Record<string, any>
) {
  emitStreamEvent(io, {
    type: 'stream.end',
    sessionId,
    messageId,
    metadata,
    timestamp: Date.now()
  })
}

export function streamError(
  io: SocketIOServer,
  sessionId: string,
  messageId: string,
  error: string
) {
  emitStreamEvent(io, {
    type: 'stream.error',
    sessionId,
    messageId,
    error,
    timestamp: Date.now()
  })
}

// Helper function to notify session updates
export function notifySessionUpdate(
  io: SocketIOServer,
  sessionId: string,
  update: {
    title?: string
    status?: string
    lastActivity?: string
  }
) {
  emitToSession(io, sessionId, 'session_update', {
    sessionId,
    update
  })
}