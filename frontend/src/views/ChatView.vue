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
          <div class="chat-actions">
            <button @click="toggleSettings" class="btn-icon">⚙️</button>
          </div>
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
          >
            <div class="message-avatar">
              {{ message.sender === 'user' ? '👤' : '🤖' }}
            </div>
            <div class="message-content">
              <div class="message-text" v-html="formatMessage(message.content)"></div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const chatStore = useChatStore()
const authStore = useAuthStore()

const messagesContainer = ref<HTMLElement>()
const inputMessage = ref('')
const isLoading = ref(false)

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

function formatMessage(content: string): string {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
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
  router.push('/settings')
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
}

.message-text {
  line-height: 1.5;

  :deep(code) {
    background: rgba(0, 0, 0, 0.2);
    padding: 0.125rem 0.25rem;
    border-radius: var(--radius-sm);
    font-family: 'Fira Code', monospace;
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
</style>