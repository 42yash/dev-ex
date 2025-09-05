import { io, Socket } from 'socket.io-client'
import { ref } from 'vue'

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  
  public connected = ref(false)
  public connectionError = ref<string | null>(null)
  
  constructor() {
    // Don't auto-connect, wait for manual connection with token
  }
  
  connect() {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:8080'
    const token = localStorage.getItem('accessToken')
    
    console.log('WebSocket connecting to:', wsUrl)
    console.log('Token available:', !!token)
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      auth: {
        token: token
      }
    })
    
    this.setupEventListeners()
  }
  
  private setupEventListeners() {
    if (!this.socket) return
    
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.connected.value = true
      this.connectionError.value = null
      this.reconnectAttempts = 0
    })
    
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.connected.value = false
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        this.attemptReconnect()
      }
    })
    
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.connectionError.value = error.message
      this.connected.value = false
    })
    
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.connectionError.value = error.message
    })
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.connectionError.value = 'Unable to connect to server'
      return
    }
    
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}`)
      this.connect()
    }, delay)
  }
  
  // Emit events
  emit(event: string, data?: any) {
    if (!this.socket || !this.connected.value) {
      console.warn('Cannot emit event: WebSocket not connected')
      return
    }
    
    this.socket.emit(event, data)
  }
  
  // Listen to events
  on(event: string, callback: (data: any) => void) {
    if (!this.socket) {
      console.warn('Cannot listen to event: WebSocket not initialized')
      return
    }
    
    this.socket.on(event, callback)
  }
  
  off(event: string, callback?: (data: any) => void) {
    if (!this.socket) return
    
    if (callback) {
      this.socket.off(event, callback)
    } else {
      this.socket.off(event)
    }
  }
  
  // Join a room (for session-specific updates)
  joinSession(sessionId: string) {
    this.emit('join_session', { sessionId })
  }
  
  leaveSession(sessionId: string) {
    this.emit('leave_session', { sessionId })
  }
  
  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
  
  // Reconnect manually
  reconnect() {
    this.disconnect()
    this.reconnectAttempts = 0
    this.connect()
  }
}

// Export singleton instance
export const wsService = new WebSocketService()

// Export types for events
export interface ChatMessageEvent {
  sessionId: string
  message: {
    id: string
    sender: 'user' | 'ai'
    content: string
    timestamp: string
    widgets?: any[]
    metadata?: Record<string, any>
  }
}

export interface StreamingMessageEvent {
  sessionId: string
  messageId: string
  chunk: string
  isComplete: boolean
}

export interface SessionUpdateEvent {
  sessionId: string
  update: {
    title?: string
    status?: string
    lastActivity?: string
  }
}