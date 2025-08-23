<template>
  <div class="chat-view">
    <div class="chat-container">
      <!-- Sidebar -->
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <button @click="createNewSession" class="btn-new-chat">
            <span class="icon">+</span>
            New Chat
          </button>
        </div>
        <div class="sessions-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            @click="selectSession(session.id)"
            :class="['session-item', { active: session.id === currentSessionId }]"
          >
            <h4>{{ session.title }}</h4>
            <p>{{ formatDate(session.lastActivity) }}</p>
          </div>
        </div>
      </aside>

      <!-- Main Chat Area -->
      <main class="chat-main">
        <div class="chat-header">
          <h2>{{ currentSession?.title || 'New Chat' }}</h2>
        </div>

        <div class="messages-container" ref="messagesContainer">
          <div v-if="messages.length === 0" class="empty-state">
            <h3>Welcome to Dev-Ex</h3>
            <p>Start a conversation by typing a message below</p>
            <div class="suggestions">
              <button
                v-for="suggestion in suggestions"
                :key="suggestion"
                @click="sendMessage(suggestion)"
                class="suggestion-chip"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            :class="['message', `message-${message.sender}`]"
            @mouseenter="hoveredMessageId = message.id"
            @mouseleave="hoveredMessageId = null"
          >
            <div class="message-avatar">
              {{ message.sender === 'user' ? '👤' : '🤖' }}
            </div>
            <div class="message-content">
              <MessageActions
                :message="message"
                :show-actions="hoveredMessageId === message.id"
                @edit-message="handleEditMessage"
                @delete-message="handleDeleteMessage"
                @regenerate-response="handleRegenerateResponse"
              />
              <div class="message-text">
                <template v-for="(part, index) in parseMessage(message.content)" :key="index">
                  <CodeBlock v-if="part.type === 'code'" :code="part.content" :language="part.language" />
                  <span v-else v-html="formatInlineText(part.content)"></span>
                </template>
              </div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>

          <div v-if="isLoading" class="message message-ai">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="input-container">
          <textarea
            v-model="inputMessage"
            @keydown.enter.prevent="handleEnter"
            placeholder="Type your message..."
            class="message-input"
            :disabled="isLoading"
          ></textarea>
          <button
            @click="sendMessage()"
            :disabled="!inputMessage.trim() || isLoading"
            class="send-button"
          >
            Send
          </button>
        </div>
      </main>
    </div>

    <!-- Floating Settings Button -->
    <button @click="toggleSettings" class="floating-settings-btn" title="Settings">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6m4.22-13.22l-4.24 4.24m0 5.96l4.24 4.24M20 12h-6m-6 0H2m13.22 4.22l-4.24-4.24m0-5.96l-4.24-4.24"></path>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import MessageActions from '@/components/MessageActions.vue'
import CodeBlock from '@/components/CodeBlock.vue'

const router = useRouter()
const chatStore = useChatStore()
const authStore = useAuthStore()

const messagesContainer = ref<HTMLElement>()
const inputMessage = ref('')
const isLoading = ref(false)
const hoveredMessageId = ref<string | null>(null)

const sessions = computed(() => chatStore.sessions)
const currentSessionId = computed(() => chatStore.currentSessionId)
const currentSession = computed(() => chatStore.currentSession)
const messages = computed(() => chatStore.currentMessages)

const suggestions = [
  "How do I deploy a static website to AWS?",
  "Help me design a microservices architecture",
  "What's the best way to implement authentication?"
]

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  
  await chatStore.loadSessions()
})

async function createNewSession() {
  await chatStore.createSession()
}

async function selectSession(sessionId: string) {
  await chatStore.selectSession(sessionId)
  scrollToBottom()
}

async function sendMessage(text?: string) {
  const message = text || inputMessage.value.trim()
  if (!message) return
  
  inputMessage.value = ''
  isLoading.value = true
  
  try {
    await chatStore.sendMessage(message)
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('Failed to send message:', error)
  } finally {
    isLoading.value = false
  }
}

function handleEnter(event: KeyboardEvent) {
  if (!event.shiftKey) {
    sendMessage()
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

interface MessagePart {
  type: 'text' | 'code'
  content: string
  language?: string
}

function parseMessage(content: string): MessagePart[] {
  const parts: MessagePart[] = []
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      })
    }

    // Add code block
    parts.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || undefined
    })

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    })
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }]
}

function formatInlineText(content: string): string {
  // Format inline markdown elements
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\n/g, '<br>')
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function toggleSettings() {
  router.push('/dashboard')
}

// Message action handlers
async function handleEditMessage(messageId: string, newContent: string) {
  // Find the message and update it
  const messages = chatStore.messages.get(currentSessionId.value || '')
  if (messages) {
    const message = messages.find(m => m.id === messageId)
    if (message) {
      message.content = newContent
      // In a real app, you'd also send this to the backend
      // await chatApi.updateMessage(messageId, newContent)
    }
  }
}

async function handleDeleteMessage(messageId: string) {
  // Remove the message from the store
  const messages = chatStore.messages.get(currentSessionId.value || '')
  if (messages) {
    const index = messages.findIndex(m => m.id === messageId)
    if (index > -1) {
      messages.splice(index, 1)
      // In a real app, you'd also send this to the backend
      // await chatApi.deleteMessage(messageId)
    }
  }
}

async function handleRegenerateResponse(messageId: string) {
  // Find the previous user message and resend it
  const messages = chatStore.messages.get(currentSessionId.value || '')
  if (messages) {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex > 0) {
      const previousMessage = messages[messageIndex - 1]
      if (previousMessage.sender === 'user') {
        // Remove the AI response
        messages.splice(messageIndex, 1)
        // Resend the user message
        isLoading.value = true
        try {
          await chatStore.sendMessage(previousMessage.content)
          await nextTick()
          scrollToBottom()
        } catch (error) {
          console.error('Failed to regenerate response:', error)
        } finally {
          isLoading.value = false
        }
      }
    }
  }
}
</script>

<style scoped lang="scss">
.chat-view {
  height: 100vh;
  display: flex;
  background: var(--bg-primary);
}

.chat-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.chat-sidebar {
  width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.btn-new-chat {
  width: 100%;
  padding: 0.75rem;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all var(--transition-fast);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
  }

  .icon {
    font-size: 1.25rem;
  }
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.session-item {
  padding: 0.75rem;
  margin-bottom: 0.25rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    background: rgba(0, 255, 136, 0.1);
    border-left: 3px solid var(--accent);
  }

  h4 {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    font-size: 1.25rem;
  }
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-secondary);
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.suggestion-chip {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--accent);
  }
}

.message {
  display: flex;
  gap: 1rem;
  animation: slideIn var(--transition-base);

  &-user {
    flex-direction: row-reverse;

    .message-content {
      background: var(--accent);
      color: var(--bg-primary);
    }
  }

  &-ai {
    .message-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
    }
  }
}

.message-avatar {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.message-content {
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg);
  position: relative;
}

.message-text {
  line-height: 1.5;

  :deep(.inline-code) {
    background: rgba(0, 255, 136, 0.1);
    color: var(--accent);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    font-family: 'Fira Code', monospace;
    font-size: 0.875em;
    border: 1px solid rgba(0, 255, 136, 0.2);
  }
  
  :deep(strong) {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  :deep(em) {
    font-style: italic;
  }
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.typing-indicator {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 0;

  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-secondary);
    animation: pulse 1.4s infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

.input-container {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 1rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  resize: none;
  font-family: inherit;
  min-height: 50px;
  max-height: 150px;

  &:focus {
    outline: none;
    border-color: var(--accent);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.send-button {
  padding: 0.75rem 1.5rem;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.floating-settings-btn {
  position: fixed;
  bottom: 2rem;
  left: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  z-index: 1000;
}

.floating-settings-btn:hover {
  transform: scale(1.1) rotate(45deg);
  background: var(--accent-secondary);
  box-shadow: 0 6px 20px rgba(0, 255, 136, 0.5);
}

.floating-settings-btn svg {
  width: 24px;
  height: 24px;
}

.floating-settings-btn:active {
  transform: scale(0.95);
}
</style>