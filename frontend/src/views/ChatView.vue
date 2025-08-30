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
            :class="['session-item', { active: session.id === currentSessionId }]"
          >
            <div @click="selectSession(session.id)" class="session-content">
              <div class="session-info">
                <h4>{{ session.title }}</h4>
                <p>{{ formatDate(session.lastActivity) }}</p>
              </div>
              <button
                @click.stop="deleteSession(session.id)"
                class="delete-btn"
                title="Delete session"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
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
            <p class="tagline">What do you wanna build today?</p>
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
              
              <!-- Regular message text -->
              <div v-if="!message.widgets || message.widgets.length === 0" class="message-text">
                <template v-for="(part, index) in parseMessage(message.content)" :key="index">
                  <CodeBlock v-if="part.type === 'code'" :code="part.content" :language="part.language" />
                  <span v-else v-html="formatInlineText(part.content)"></span>
                </template>
              </div>
              
              <!-- Widget-enhanced message -->
              <div v-else class="message-with-widgets">
                <div v-if="message.content" class="message-text">
                  <template v-for="(part, index) in parseMessage(message.content)" :key="`widget-${index}`">
                    <CodeBlock v-if="part.type === 'code'" :code="part.content" :language="part.language" />
                    <span v-else v-html="formatInlineText(part.content)"></span>
                  </template>
                </div>
                <div class="message-widgets">
                  <WidgetRenderer
                    v-for="widget in message.widgets"
                    :key="widget.id"
                    :widget="widget"
                    @change="handleWidgetChange"
                    @action="handleWidgetAction"
                  />
                </div>
                <div v-if="message.widgetResponse?.submitButton" class="widget-actions">
                  <button 
                    @click="submitWidgetForm(message.id)"
                    :disabled="!widgetStore.isFormValid"
                    class="btn-submit"
                  >
                    {{ message.widgetResponse.submitButton.label }}
                  </button>
                  <button 
                    v-if="message.widgetResponse.cancelButton?.visible"
                    @click="cancelWidgetForm(message.id)"
                    class="btn-cancel"
                  >
                    {{ message.widgetResponse.cancelButton.label }}
                  </button>
                </div>
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

    <!-- Floating Buttons -->
    <button @click="showDemoWidgets" class="floating-demo-btn" title="Demo Widgets">
      🎯
    </button>
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
import { useWidgetStore } from '@/stores/widgets'
import { useRouter } from 'vue-router'
import MessageActions from '@/components/MessageActions.vue'
import CodeBlock from '@/components/CodeBlock.vue'
import WidgetRenderer from '@/components/widgets/WidgetRenderer.vue'
import { parseAIResponse, generateSampleWidgets } from '@/utils/widgetParser'
import type { WidgetEvent } from '@/types/widget'

const router = useRouter()
const chatStore = useChatStore()
const authStore = useAuthStore()
const widgetStore = useWidgetStore()

const messagesContainer = ref<HTMLElement>()
const inputMessage = ref('')
const isLoading = ref(false)
const hoveredMessageId = ref<string | null>(null)

const sessions = computed(() => chatStore.sessions)
const currentSessionId = computed(() => chatStore.currentSessionId)
const currentSession = computed(() => chatStore.currentSession)
const messages = computed(() => chatStore.currentMessages)

const suggestions = [
  "Build a web application with React and Node.js",
  "Create a REST API with authentication",
  "Design a microservices architecture"
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

async function deleteSession(sessionId: string) {
  // Show confirmation dialog
  const confirmDelete = confirm('Are you sure you want to delete this chat session? This action cannot be undone.')
  
  if (!confirmDelete) return
  
  try {
    // Call API to delete session
    await fetch(`/api/v1/chat/session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    // Remove from sessions list
    const index = sessions.value.findIndex(s => s.id === sessionId)
    if (index > -1) {
      sessions.value.splice(index, 1)
    }
    
    // If we deleted the current session, create a new one
    if (currentSessionId.value === sessionId) {
      await createNewSession()
    }
    
    // Show success message (optional)
    console.log('Session deleted successfully')
  } catch (error) {
    console.error('Failed to delete session:', error)
    alert('Failed to delete session. Please try again.')
  }
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
  // Split content into lines for processing
  const lines = content.split('\n')
  let result = ''
  let listStack: Array<{type: 'ul' | 'ol', indent: number}> = []
  
  lines.forEach((line, index) => {
    // Handle headings
    if (line.startsWith('### ')) {
      // Close all open lists
      while (listStack.length > 0) {
        result += '</' + listStack.pop()!.type + '>'
      }
      result += '<h3>' + formatInlineMarkdown(line.slice(4)) + '</h3>'
      return
    } else if (line.startsWith('## ')) {
      // Close all open lists
      while (listStack.length > 0) {
        result += '</' + listStack.pop()!.type + '>'
      }
      result += '<h2>' + formatInlineMarkdown(line.slice(3)) + '</h2>'
      return
    } else if (line.startsWith('# ')) {
      // Close all open lists
      while (listStack.length > 0) {
        result += '</' + listStack.pop()!.type + '>'
      }
      result += '<h1>' + formatInlineMarkdown(line.slice(2)) + '</h1>'
      return
    }
    
    // Check if line is a list item
    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.*)$/)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)
    
    if (unorderedMatch || orderedMatch) {
      const isOrdered = !!orderedMatch
      const match = unorderedMatch || orderedMatch!
      const indent = match[1].length
      const content = isOrdered ? match[3] : match[2]
      const newType = isOrdered ? 'ol' : 'ul'
      
      // Determine indent level (assuming 2 or 4 spaces per level)
      const indentLevel = Math.floor(indent / 2)
      
      // Close lists that are deeper than current indent
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indentLevel) {
        result += '</' + listStack.pop()!.type + '>'
      }
      
      // If we have a list at the same level but different type, close it
      if (listStack.length > 0 && 
          listStack[listStack.length - 1].indent === indentLevel && 
          listStack[listStack.length - 1].type !== newType) {
        result += '</' + listStack.pop()!.type + '>'
      }
      
      // Open new list if needed
      if (listStack.length === 0 || listStack[listStack.length - 1].indent < indentLevel) {
        result += '<' + newType + '>'
        listStack.push({type: newType, indent: indentLevel})
      } else if (listStack.length === 0 || listStack[listStack.length - 1].indent !== indentLevel) {
        result += '<' + newType + '>'
        listStack.push({type: newType, indent: indentLevel})
      }
      
      result += '<li>' + formatInlineMarkdown(content) + '</li>'
    } else {
      // Not a list item - close all open lists
      while (listStack.length > 0) {
        result += '</' + listStack.pop()!.type + '>'
      }
      
      // Handle regular text
      const formattedLine = formatInlineMarkdown(line)
      if (formattedLine.trim()) {
        result += formattedLine
        // Add line break if not the last line and next line isn't empty
        if (index < lines.length - 1 && lines[index + 1].trim()) {
          result += '<br>'
        }
      } else if (index < lines.length - 1) {
        // Empty line - add spacing
        result += '<br>'
      }
    }
  })
  
  // Close any remaining open lists
  while (listStack.length > 0) {
    result += '</' + listStack.pop()!.type + '>'
  }
  
  return result
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
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

// Widget handling functions
function handleWidgetChange(event: WidgetEvent) {
  console.log('Widget changed:', event)
  widgetStore.handleWidgetEvent(event)
}

function handleWidgetAction(event: WidgetEvent) {
  console.log('Widget action:', event)
  widgetStore.handleWidgetEvent(event)
}

async function submitWidgetForm(messageId: string) {
  if (!widgetStore.isFormValid) {
    console.warn('Form is not valid')
    return
  }
  
  // Get form data and send as a message
  const formData = widgetStore.formData
  const formMessage = `Form submitted: ${JSON.stringify(formData, null, 2)}`
  
  // Clear widgets after submission
  widgetStore.clearWidgets()
  
  // Send the form data as a new message
  await sendMessage(formMessage)
}

function cancelWidgetForm(messageId: string) {
  widgetStore.clearWidgets()
  console.log('Widget form cancelled')
}

// Demo function to show widgets (for testing)
function showDemoWidgets() {
  const sampleWidgets = generateSampleWidgets()
  
  // Add a message with widgets
  const demoMessage = {
    id: Date.now().toString(),
    sender: 'ai' as const,
    content: '',
    text: 'Let\'s configure your new application. Please answer the following questions:',
    widgets: sampleWidgets,
    widgetResponse: {
      widgets: sampleWidgets,
      layout: 'single' as const,
      submitButton: { label: 'Continue' }
    },
    timestamp: new Date()
  }
  
  // Add to messages
  const messages = chatStore.messages.get(currentSessionId.value || '')
  if (messages) {
    messages.push(demoMessage)
  }
  
  // Load widgets into store
  widgetStore.loadWidgetResponse(demoMessage.widgetResponse)
}

// Intercept AI responses to parse widgets
chatStore.$onAction(({ name, after }) => {
  if (name === 'addMessage') {
    after((result) => {
      const messages = chatStore.messages.get(currentSessionId.value || '')
      if (messages && messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.sender === 'ai') {
          // Parse AI response for widgets
          const parsed = parseAIResponse(lastMessage.content)
          if (parsed.widgets || parsed.widgetResponse) {
            // Update message with parsed widgets
            lastMessage.text = parsed.text
            lastMessage.widgets = parsed.widgets
            lastMessage.widgetResponse = parsed.widgetResponse
            
            // Load widgets into store
            if (parsed.widgetResponse) {
              widgetStore.loadWidgetResponse(parsed.widgetResponse)
            } else if (parsed.widgets) {
              widgetStore.addWidgets(parsed.widgets)
            }
          }
        }
      }
    })
  }
})
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
  margin-bottom: 0.25rem;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
  position: relative;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    
    .delete-btn {
      opacity: 1;
    }
  }

  &.active {
    background: rgba(0, 255, 136, 0.1);
    border-left: 3px solid var(--accent);
    
    .delete-btn {
      opacity: 0.5;
    }
  }

  .session-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    cursor: pointer;
  }

  .session-info {
    flex: 1;
    min-width: 0;
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

  .delete-btn {
    opacity: 0;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: 0.5rem;

    &:hover {
      background: rgba(255, 0, 0, 0.2);
      color: #ff4444;
    }

    svg {
      width: 16px;
      height: 16px;
    }
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
  
  .tagline {
    font-size: 1.25rem;
    color: var(--accent);
    font-weight: 500;
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
}

.message-with-widgets {
  width: 100%;
  
  .message-text {
    margin-bottom: 1rem;
  }
  
  .message-widgets {
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .widget-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    
    .btn-submit,
    .btn-cancel {
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius);
      font-weight: 500;
      transition: all var(--transition-fast);
      cursor: pointer;
      border: none;
      font-size: 0.875rem;
    }
    
    .btn-submit {
      background: var(--accent);
      color: var(--bg-primary);
      
      &:hover:not(:disabled) {
        background: var(--accent-bright);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    .btn-cancel {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--text-secondary);
      }
    }
  }
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
  
  :deep(h1) {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 1rem 0 0.5rem;
    color: var(--text-primary);
  }
  
  :deep(h2) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0.875rem 0 0.5rem;
    color: var(--text-primary);
  }
  
  :deep(h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0.75rem 0 0.5rem;
    color: var(--text-primary);
  }
  
  :deep(ul), :deep(ol) {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
    list-style-position: outside;
  }
  
  :deep(ul) {
    list-style-type: disc;
  }
  
  :deep(ol) {
    list-style-type: decimal;
  }
  
  :deep(li) {
    margin: 0.375rem 0;
    line-height: 1.6;
    padding-left: 0.25rem;
  }
  
  :deep(li > ul), :deep(li > ol) {
    margin: 0.25rem 0;
  }
  
  :deep(a) {
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
    
    &:hover {
      border-bottom-color: var(--accent);
    }
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

.floating-demo-btn,
.floating-settings-btn {
  position: fixed;
  bottom: 2rem;
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
  font-size: 1.5rem;
}

.floating-demo-btn {
  left: 2rem;
}

.floating-settings-btn {
  left: 5rem;
}

.floating-demo-btn:hover {
  transform: scale(1.1);
  background: var(--accent-secondary);
  box-shadow: 0 6px 20px rgba(0, 255, 136, 0.5);
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