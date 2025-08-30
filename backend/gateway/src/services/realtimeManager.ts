import { Server as SocketIOServer } from 'socket.io'
import { EventEmitter } from 'events'
import { logger } from '../utils/logger.js'
import { query } from '../db/index.js'
import { getSession, setSession } from './redis'

// Real-time event types
export enum RealtimeEvent {
  // Chat events
  MESSAGE_NEW = 'message:new',
  MESSAGE_UPDATE = 'message:update',
  MESSAGE_DELETE = 'message:delete',
  MESSAGE_STREAM = 'message:stream',
  
  // Session events
  SESSION_CREATE = 'session:create',
  SESSION_UPDATE = 'session:update',
  SESSION_DELETE = 'session:delete',
  SESSION_USER_JOIN = 'session:user:join',
  SESSION_USER_LEAVE = 'session:user:leave',
  
  // User events
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_TYPING = 'user:typing',
  USER_STOPPED_TYPING = 'user:stopped_typing',
  
  // Agent events
  AGENT_STARTED = 'agent:started',
  AGENT_PROGRESS = 'agent:progress',
  AGENT_COMPLETED = 'agent:completed',
  AGENT_FAILED = 'agent:failed',
  
  // Widget events
  WIDGET_INTERACTION = 'widget:interaction',
  WIDGET_UPDATE = 'widget:update',
  
  // System events
  NOTIFICATION = 'notification',
  ERROR = 'error',
  RECONNECT = 'reconnect'
}

// User presence tracking
interface UserPresence {
  userId: string
  socketId: string
  status: 'online' | 'away' | 'busy'
  lastActivity: Date
  sessions: Set<string>
}

// Typing indicator tracking
interface TypingUser {
  userId: string
  sessionId: string
  startedAt: Date
  timeout?: NodeJS.Timeout
}

export class RealtimeManager extends EventEmitter {
  private io: SocketIOServer
  private userPresence: Map<string, UserPresence> = new Map()
  private typingUsers: Map<string, TypingUser> = new Map()
  private sessionUsers: Map<string, Set<string>> = new Map()
  private messageQueues: Map<string, any[]> = new Map()
  
  constructor(io: SocketIOServer) {
    super()
    this.io = io
    this.setupEventHandlers()
    this.startPresenceMonitor()
  }
  
  private setupEventHandlers() {
    // Internal event handlers
    this.on(RealtimeEvent.MESSAGE_NEW, this.handleNewMessage.bind(this))
    this.on(RealtimeEvent.MESSAGE_STREAM, this.handleMessageStream.bind(this))
    this.on(RealtimeEvent.AGENT_PROGRESS, this.handleAgentProgress.bind(this))
  }
  
  // User presence management
  async addUser(userId: string, socketId: string) {
    const presence: UserPresence = {
      userId,
      socketId,
      status: 'online',
      lastActivity: new Date(),
      sessions: new Set()
    }
    
    this.userPresence.set(userId, presence)
    
    // Notify other users
    this.io.emit(RealtimeEvent.USER_ONLINE, {
      userId,
      timestamp: new Date()
    })
    
    // Update database
    await query(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP, is_online = true WHERE id = $1',
      [userId]
    )
    
    // Store in Redis for distributed systems
    await setSession(`presence:${userId}`, {
      status: 'online',
      socketId,
      timestamp: new Date()
    }, 300) // 5 minute TTL
    
    logger.info(`User ${userId} is now online`)
  }
  
  async removeUser(userId: string) {
    const presence = this.userPresence.get(userId)
    if (!presence) return
    
    // Remove from all sessions
    for (const sessionId of presence.sessions) {
      await this.removeUserFromSession(userId, sessionId)
    }
    
    this.userPresence.delete(userId)
    
    // Notify other users
    this.io.emit(RealtimeEvent.USER_OFFLINE, {
      userId,
      timestamp: new Date()
    })
    
    // Update database
    await query(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP, is_online = false WHERE id = $1',
      [userId]
    )
    
    // Remove from Redis
    await setSession(`presence:${userId}`, null, 1)
    
    logger.info(`User ${userId} is now offline`)
  }
  
  // Session management
  async addUserToSession(userId: string, sessionId: string) {
    const presence = this.userPresence.get(userId)
    if (!presence) return
    
    presence.sessions.add(sessionId)
    
    // Track session users
    if (!this.sessionUsers.has(sessionId)) {
      this.sessionUsers.set(sessionId, new Set())
    }
    this.sessionUsers.get(sessionId)!.add(userId)
    
    // Join socket room
    const socket = this.io.sockets.sockets.get(presence.socketId)
    if (socket) {
      socket.join(`session:${sessionId}`)
      
      // Notify session members
      this.io.to(`session:${sessionId}`).emit(RealtimeEvent.SESSION_USER_JOIN, {
        userId,
        sessionId,
        timestamp: new Date()
      })
    }
    
    // Send any queued messages
    await this.flushMessageQueue(sessionId, userId)
  }
  
  async removeUserFromSession(userId: string, sessionId: string) {
    const presence = this.userPresence.get(userId)
    if (presence) {
      presence.sessions.delete(sessionId)
      
      // Leave socket room
      const socket = this.io.sockets.sockets.get(presence.socketId)
      if (socket) {
        socket.leave(`session:${sessionId}`)
      }
    }
    
    // Update session users
    const sessionUserSet = this.sessionUsers.get(sessionId)
    if (sessionUserSet) {
      sessionUserSet.delete(userId)
      if (sessionUserSet.size === 0) {
        this.sessionUsers.delete(sessionId)
      }
    }
    
    // Notify session members
    this.io.to(`session:${sessionId}`).emit(RealtimeEvent.SESSION_USER_LEAVE, {
      userId,
      sessionId,
      timestamp: new Date()
    })
    
    // Clear typing indicator
    this.stopTyping(userId, sessionId)
  }
  
  // Typing indicators
  startTyping(userId: string, sessionId: string) {
    const key = `${userId}:${sessionId}`
    
    // Clear existing timeout
    const existing = this.typingUsers.get(key)
    if (existing?.timeout) {
      clearTimeout(existing.timeout)
    }
    
    // Set typing indicator
    const typingUser: TypingUser = {
      userId,
      sessionId,
      startedAt: new Date(),
      timeout: setTimeout(() => {
        this.stopTyping(userId, sessionId)
      }, 5000) // Auto-stop after 5 seconds
    }
    
    this.typingUsers.set(key, typingUser)
    
    // Notify session members
    this.io.to(`session:${sessionId}`).emit(RealtimeEvent.USER_TYPING, {
      userId,
      sessionId,
      timestamp: new Date()
    })
  }
  
  stopTyping(userId: string, sessionId: string) {
    const key = `${userId}:${sessionId}`
    const typingUser = this.typingUsers.get(key)
    
    if (typingUser) {
      if (typingUser.timeout) {
        clearTimeout(typingUser.timeout)
      }
      this.typingUsers.delete(key)
      
      // Notify session members
      this.io.to(`session:${sessionId}`).emit(RealtimeEvent.USER_STOPPED_TYPING, {
        userId,
        sessionId,
        timestamp: new Date()
      })
    }
  }
  
  // Message handling
  private async handleNewMessage(data: {
    sessionId: string
    message: any
    senderId: string
  }) {
    const { sessionId, message, senderId } = data
    
    // Check if session has active users
    const sessionUserSet = this.sessionUsers.get(sessionId)
    if (!sessionUserSet || sessionUserSet.size === 0) {
      // Queue message for later delivery
      this.queueMessage(sessionId, message)
      return
    }
    
    // Broadcast to session members except sender
    const senderPresence = this.userPresence.get(senderId)
    if (senderPresence) {
      const socket = this.io.sockets.sockets.get(senderPresence.socketId)
      if (socket) {
        socket.to(`session:${sessionId}`).emit(RealtimeEvent.MESSAGE_NEW, {
          sessionId,
          message,
          timestamp: new Date()
        })
      }
    } else {
      // Sender not connected, broadcast to all
      this.io.to(`session:${sessionId}`).emit(RealtimeEvent.MESSAGE_NEW, {
        sessionId,
        message,
        timestamp: new Date()
      })
    }
  }
  
  private async handleMessageStream(data: {
    sessionId: string
    messageId: string
    chunk: string
    isComplete: boolean
  }) {
    this.io.to(`session:${data.sessionId}`).emit(RealtimeEvent.MESSAGE_STREAM, data)
  }
  
  // Agent progress updates
  private async handleAgentProgress(data: {
    sessionId: string
    agentName: string
    progress: number
    status: string
    message?: string
  }) {
    this.io.to(`session:${data.sessionId}`).emit(RealtimeEvent.AGENT_PROGRESS, {
      ...data,
      timestamp: new Date()
    })
  }
  
  // Message queueing for offline delivery
  private queueMessage(sessionId: string, message: any) {
    if (!this.messageQueues.has(sessionId)) {
      this.messageQueues.set(sessionId, [])
    }
    
    const queue = this.messageQueues.get(sessionId)!
    queue.push({
      message,
      queuedAt: new Date()
    })
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift() // Remove oldest
    }
    
    logger.debug(`Message queued for session ${sessionId}`)
  }
  
  private async flushMessageQueue(sessionId: string, userId: string) {
    const queue = this.messageQueues.get(sessionId)
    if (!queue || queue.length === 0) return
    
    const presence = this.userPresence.get(userId)
    if (!presence) return
    
    const socket = this.io.sockets.sockets.get(presence.socketId)
    if (!socket) return
    
    // Send queued messages
    for (const item of queue) {
      socket.emit(RealtimeEvent.MESSAGE_NEW, {
        sessionId,
        message: item.message,
        timestamp: item.queuedAt,
        wasQueued: true
      })
    }
    
    // Clear queue
    this.messageQueues.delete(sessionId)
    logger.info(`Flushed ${queue.length} queued messages for session ${sessionId}`)
  }
  
  // Presence monitoring
  private startPresenceMonitor() {
    setInterval(() => {
      const now = new Date()
      const timeout = 5 * 60 * 1000 // 5 minutes
      
      for (const [userId, presence] of this.userPresence.entries()) {
        const timeSinceActivity = now.getTime() - presence.lastActivity.getTime()
        
        if (timeSinceActivity > timeout) {
          // Mark as away
          if (presence.status === 'online') {
            presence.status = 'away'
            this.io.emit('user:away', { userId })
          }
        }
        
        // Remove if disconnected too long
        if (timeSinceActivity > timeout * 2) {
          this.removeUser(userId)
        }
      }
    }, 60000) // Check every minute
  }
  
  // Update user activity
  updateUserActivity(userId: string) {
    const presence = this.userPresence.get(userId)
    if (presence) {
      presence.lastActivity = new Date()
      if (presence.status === 'away') {
        presence.status = 'online'
        this.io.emit('user:back', { userId })
      }
    }
  }
  
  // Widget interactions
  handleWidgetInteraction(data: {
    sessionId: string
    widgetId: string
    interaction: any
    userId: string
  }) {
    this.io.to(`session:${data.sessionId}`).emit(RealtimeEvent.WIDGET_INTERACTION, {
      ...data,
      timestamp: new Date()
    })
  }
  
  // Notifications
  sendNotification(userId: string, notification: {
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    actions?: any[]
  }) {
    const presence = this.userPresence.get(userId)
    if (presence) {
      const socket = this.io.sockets.sockets.get(presence.socketId)
      if (socket) {
        socket.emit(RealtimeEvent.NOTIFICATION, {
          ...notification,
          timestamp: new Date()
        })
      }
    }
  }
  
  // Broadcast to all users
  broadcast(event: string, data: any) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date()
    })
  }
  
  // Get online users
  getOnlineUsers(): string[] {
    return Array.from(this.userPresence.keys())
  }
  
  // Get session users
  getSessionUsers(sessionId: string): string[] {
    const users = this.sessionUsers.get(sessionId)
    return users ? Array.from(users) : []
  }
  
  // Check if user is typing
  isUserTyping(userId: string, sessionId: string): boolean {
    return this.typingUsers.has(`${userId}:${sessionId}`)
  }
}

// Export singleton instance
let realtimeManager: RealtimeManager | null = null

export function initializeRealtimeManager(io: SocketIOServer): RealtimeManager {
  if (!realtimeManager) {
    realtimeManager = new RealtimeManager(io)
  }
  return realtimeManager
}

export function getRealtimeManager(): RealtimeManager {
  if (!realtimeManager) {
    throw new Error('RealtimeManager not initialized')
  }
  return realtimeManager
}