import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { chatApi } from '@/services/api'
import { wsService, type ChatMessageEvent, type StreamingMessageEvent, type SessionUpdateEvent } from '@/services/websocket'

export interface Message {
  id: string
  sessionId: string
  sender: 'user' | 'ai'
  content: string
  timestamp: string
  widgets?: any[]
  metadata?: Record<string, any>
}

export interface Session {
  id: string
  title: string
  status: string
  createdAt: string
  lastActivity: string
  messageCount?: number
}

export const useChatStore = defineStore('chat', () => {
  // State
  const sessions = ref<Session[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<Map<string, Message[]>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const streamingMessages = ref<Map<string, string>>(new Map())
  const wsConnected = computed(() => wsService.connected.value)

  // Getters
  const currentSession = computed(() => 
    sessions.value.find(s => s.id === currentSessionId.value)
  )

  const currentMessages = computed(() => 
    currentSessionId.value ? messages.value.get(currentSessionId.value) || [] : []
  )

  // WebSocket event handlers
  function setupWebSocketListeners() {
    // Handle incoming messages
    wsService.on('chat_message', (data: ChatMessageEvent) => {
      const sessionMessages = messages.value.get(data.sessionId) || []
      const existingIndex = sessionMessages.findIndex(m => m.id === data.message.id)
      
      if (existingIndex === -1) {
        sessionMessages.push(data.message)
        messages.value.set(data.sessionId, sessionMessages)
      }
    })

    // Handle streaming messages
    wsService.on('message_stream', (data: StreamingMessageEvent) => {
      if (data.isComplete) {
        streamingMessages.value.delete(data.messageId)
      } else {
        const current = streamingMessages.value.get(data.messageId) || ''
        streamingMessages.value.set(data.messageId, current + data.chunk)
      }
    })

    // Handle session updates
    wsService.on('session_update', (data: SessionUpdateEvent) => {
      const session = sessions.value.find(s => s.id === data.sessionId)
      if (session) {
        Object.assign(session, data.update)
      }
    })
  }

  // Watch for session changes to join/leave rooms
  watch(currentSessionId, (newId, oldId) => {
    if (oldId) {
      wsService.leaveSession(oldId)
    }
    if (newId) {
      wsService.joinSession(newId)
    }
  })

  // Actions
  async function loadSessions() {
    try {
      isLoading.value = true
      error.value = null
      const response = await chatApi.getSessions()
      sessions.value = response.sessions
      
      // Select the most recent session if available
      if (sessions.value.length > 0 && !currentSessionId.value) {
        await selectSession(sessions.value[0].id)
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load sessions'
      console.error('Failed to load sessions:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function createSession(title?: string) {
    try {
      isLoading.value = true
      error.value = null
      const response = await chatApi.createSession({ title })
      sessions.value.unshift(response.session)
      currentSessionId.value = response.session.id
      messages.value.set(response.session.id, [])
      return response.session
    } catch (err: any) {
      error.value = err.message || 'Failed to create session'
      console.error('Failed to create session:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function selectSession(sessionId: string) {
    try {
      currentSessionId.value = sessionId
      
      // Load messages if not already loaded
      if (!messages.value.has(sessionId)) {
        isLoading.value = true
        const response = await chatApi.getHistory(sessionId)
        messages.value.set(sessionId, response.messages)
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load session history'
      console.error('Failed to load session history:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim()) return
    
    let sessionId = currentSessionId.value
    
    // Create a new session if none exists
    if (!sessionId) {
      const session = await createSession()
      sessionId = session.id
    }
    
    // Add user message immediately for better UX
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      sessionId,
      sender: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    
    const sessionMessages = messages.value.get(sessionId) || []
    sessionMessages.push(userMessage)
    messages.value.set(sessionId, sessionMessages)
    
    try {
      isLoading.value = true
      error.value = null
      
      const response = await chatApi.sendMessage({
        sessionId,
        message: content
      })
      
      // Add AI response
      const aiMessage: Message = {
        id: response.response.response_id,
        sessionId,
        sender: 'ai',
        content: response.response.content,
        timestamp: new Date().toISOString(),
        widgets: response.response.widgets,
        metadata: response.response.metadata
      }
      
      sessionMessages.push(aiMessage)
      messages.value.set(sessionId, sessionMessages)
      
      // Update session last activity
      const session = sessions.value.find(s => s.id === sessionId)
      if (session) {
        session.lastActivity = new Date().toISOString()
      }
      
      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to send message'
      console.error('Failed to send message:', err)
      
      // Remove the temporary user message on error
      const index = sessionMessages.findIndex(m => m.id === userMessage.id)
      if (index > -1) {
        sessionMessages.splice(index, 1)
      }
      
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      await chatApi.deleteSession(sessionId)
      
      // Remove from local state
      const index = sessions.value.findIndex(s => s.id === sessionId)
      if (index > -1) {
        sessions.value.splice(index, 1)
      }
      
      messages.value.delete(sessionId)
      
      // Select another session if this was the current one
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = sessions.value[0]?.id || null
        if (currentSessionId.value) {
          await selectSession(currentSessionId.value)
        }
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete session'
      console.error('Failed to delete session:', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  // Initialize WebSocket listeners
  setupWebSocketListeners()
  
  // Connect WebSocket when authenticated
  if (localStorage.getItem('accessToken')) {
    wsService.connect()
  }

  return {
    // State
    sessions,
    currentSessionId,
    messages,
    isLoading,
    error,
    streamingMessages,
    wsConnected,
    
    // Getters
    currentSession,
    currentMessages,
    
    // Actions
    loadSessions,
    createSession,
    selectSession,
    sendMessage,
    deleteSession,
    clearError
  }
})