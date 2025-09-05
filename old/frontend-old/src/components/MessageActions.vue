<template>
  <div class="message-actions" :class="{ visible: showActions }">
    <button
      @click="copyMessage"
      class="action-btn"
      title="Copy message"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
    
    <button
      v-if="message.sender === 'user'"
      @click="editMessage"
      class="action-btn"
      title="Edit message"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>
    
    <button
      v-if="message.sender === 'ai'"
      @click="regenerateResponse"
      class="action-btn"
      title="Regenerate response"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    </button>
    
    <button
      @click="deleteMessage"
      class="action-btn action-btn-danger"
      title="Delete message"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  </div>

  <!-- Edit Modal -->
  <Teleport to="body">
    <div v-if="isEditing" class="modal-overlay" @click="cancelEdit">
      <div class="modal-content" @click.stop>
        <h3>Edit Message</h3>
        <textarea
          v-model="editedContent"
          class="edit-textarea"
          @keydown.enter.ctrl="saveEdit"
          @keydown.escape="cancelEdit"
        ></textarea>
        <div class="modal-actions">
          <button @click="cancelEdit" class="btn-cancel">Cancel</button>
          <button @click="saveEdit" class="btn-save">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Message } from '@/stores/chat'

const props = defineProps<{
  message: Message
  showActions: boolean
}>()

const emit = defineEmits<{
  editMessage: [id: string, content: string]
  deleteMessage: [id: string]
  regenerateResponse: [id: string]
}>()

const isEditing = ref(false)
const editedContent = ref('')

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content)
    
    // Show brief success feedback
    const btn = event?.target as HTMLElement
    if (btn) {
      const originalTitle = btn.title
      btn.title = 'Copied!'
      btn.classList.add('success')
      setTimeout(() => {
        btn.title = originalTitle
        btn.classList.remove('success')
      }, 2000)
    }
  } catch (err) {
    console.error('Failed to copy message:', err)
  }
}

function editMessage() {
  editedContent.value = props.message.content
  isEditing.value = true
}

function saveEdit() {
  if (editedContent.value.trim() && editedContent.value !== props.message.content) {
    emit('editMessage', props.message.id, editedContent.value)
  }
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
  editedContent.value = ''
}

function deleteMessage() {
  if (confirm('Are you sure you want to delete this message?')) {
    emit('deleteMessage', props.message.id)
  }
}

function regenerateResponse() {
  emit('regenerateResponse', props.message.id)
}
</script>

<style scoped>
.message-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.message-actions.visible {
  opacity: 1;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.375rem;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.action-btn.success {
  color: var(--accent);
}

.action-btn-danger:hover {
  color: var(--error);
  background: rgba(255, 68, 68, 0.1);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn var(--transition-fast);
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  animation: slideUp var(--transition-base);
}

.modal-content h3 {
  margin: 0;
  color: var(--text-primary);
}

.edit-textarea {
  width: 100%;
  min-height: 150px;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

.edit-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-save {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-save {
  background: var(--accent);
  border: none;
  color: var(--bg-primary);
}

.btn-save:hover {
  background: var(--accent-secondary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 255, 136, 0.3);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>