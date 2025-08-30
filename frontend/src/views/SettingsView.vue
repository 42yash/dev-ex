<template>
  <div class="settings-view">
    <div class="settings-header">
      <h1>Settings</h1>
      <p class="settings-description">
        Configure your Dev-Ex platform preferences
      </p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading settings...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button class="btn btn-primary" @click="fetchSettings">Retry</button>
    </div>

    <div v-else class="settings-container">
      <div class="settings-section">
        <h2>General Settings</h2>
        <div class="setting-item">
          <label class="setting-label">Theme</label>
          <select 
            class="setting-control" 
            :value="settings.theme"
            @change="updateSetting('theme', ($event.target as HTMLSelectElement).value as any)"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div class="setting-item">
          <label class="setting-label">Language</label>
          <select 
            class="setting-control"
            :value="settings.language"
            @change="updateSetting('language', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="lang in languages" :key="lang.value" :value="lang.value">
              {{ lang.label }} ({{ lang.nativeName }})
            </option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h2>AI Configuration</h2>
        <div class="setting-item">
          <label class="setting-label">Model</label>
          <select 
            class="setting-control"
            :value="settings.aiModel"
            @change="updateSetting('aiModel', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="model in models" :key="model.value" :value="model.value" :disabled="!model.available">
              {{ model.label }} {{ !model.available ? '(Unavailable)' : '' }}
            </option>
          </select>
          <p class="setting-description">{{ getModelDescription() }}</p>
        </div>
        <div class="setting-item">
          <label class="setting-label">
            Temperature: {{ settings.temperature }}
          </label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            :value="settings.temperature"
            @input="updateSetting('temperature', parseFloat(($event.target as HTMLInputElement).value))"
            class="setting-control"
          >
          <p class="setting-description">
            Controls randomness: 0 = focused, 1 = creative
          </p>
        </div>
        <div class="setting-item">
          <label class="setting-label">Max Tokens</label>
          <input 
            type="number" 
            :value="settings.maxTokens"
            @input="updateSetting('maxTokens', parseInt(($event.target as HTMLInputElement).value))"
            min="100" 
            max="4096" 
            class="setting-control"
          >
          <p class="setting-description">
            Maximum length of AI responses
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h2>Documentation Sources</h2>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              :checked="settings.enableLocalDocs"
              @change="updateSetting('enableLocalDocs', ($event.target as HTMLInputElement).checked)"
            > 
            Enable Local Documentation
          </label>
        </div>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              :checked="settings.enableWebSearch"
              @change="updateSetting('enableWebSearch', ($event.target as HTMLInputElement).checked)"
            > 
            Enable Web Search
          </label>
        </div>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              :checked="settings.enableCustomSources"
              @change="updateSetting('enableCustomSources', ($event.target as HTMLInputElement).checked)"
            > 
            Enable Custom Sources
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h2>Account</h2>
        <div class="account-info">
          <p class="user-email">{{ userEmail || 'Not logged in' }}</p>
          <button class="btn btn-danger" @click="handleLogout">
            Logout
          </button>
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-secondary" @click="goBack">Back to Chat</button>
        <div>
          <span v-if="hasUnsavedChanges" class="unsaved-indicator">
            • Unsaved changes
          </span>
          <button 
            class="btn btn-secondary" 
            @click="handleReset"
            :disabled="loading"
          >
            Reset to Default
          </button>
          <button 
            class="btn btn-primary" 
            @click="handleSave"
            :disabled="loading || !hasUnsavedChanges"
          >
            {{ loading ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification (temporary implementation) -->
    <div v-if="notification" class="toast" :class="notification.type">
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

const router = useRouter()
const settingsStore = useSettingsStore()

// Use store refs for reactivity
const { settings, loading, error, hasUnsavedChanges } = storeToRefs(settingsStore)
const { 
  fetchSettings, 
  saveSettings, 
  resetSettings, 
  updateSetting,
  fetchAvailableModels,
  fetchSupportedLanguages
} = settingsStore

// Local state
const notification = ref<{ message: string; type: 'success' | 'error' } | null>(null)
const models = ref<any[]>([])
const languages = ref<any[]>([])

// Get user email from localStorage
const userEmail = computed(() => {
  const user = localStorage.getItem('user')
  if (user) {
    try {
      return JSON.parse(user).email
    } catch {
      return ''
    }
  }
  return ''
})

// Show notification
function showNotification(message: string, type: 'success' | 'error' = 'success') {
  notification.value = { message, type }
  setTimeout(() => {
    notification.value = null
  }, 3000)
}

// Get model description
function getModelDescription() {
  const model = models.value.find(m => m.value === settings.value.aiModel)
  return model?.description || ''
}

// Handle save
async function handleSave() {
  try {
    const result = await saveSettings()
    showNotification(result.message, 'success')
  } catch (err) {
    showNotification('Failed to save settings', 'error')
  }
}

// Handle reset
async function handleReset() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    try {
      const result = await resetSettings()
      showNotification(result.message, 'success')
    } catch (err) {
      showNotification('Failed to reset settings', 'error')
    }
  }
}

// Navigate back
function goBack() {
  if (hasUnsavedChanges.value) {
    if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
      router.push('/chat')
    }
  } else {
    router.push('/chat')
  }
}

// Handle logout
function handleLogout() {
  // Clear all auth data
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  
  // Navigate to home
  router.push('/')
  
  // Force reload to clear any cached state
  setTimeout(() => {
    window.location.reload()
  }, 100)
}

// Load data on mount
onMounted(async () => {
  // Fetch settings
  await fetchSettings()
  
  // Fetch available options
  const [modelsData, languagesData] = await Promise.all([
    fetchAvailableModels(),
    fetchSupportedLanguages()
  ])
  
  models.value = modelsData || [
    { value: 'gemini', label: 'Gemini Pro', description: 'Google\'s advanced language model', available: true },
    { value: 'gpt4', label: 'GPT-4', description: 'OpenAI\'s most capable model', available: false },
    { value: 'claude', label: 'Claude', description: 'Anthropic\'s helpful AI assistant', available: false }
  ]
  
  languages.value = languagesData || [
    { value: 'en', label: 'English', nativeName: 'English' },
    { value: 'es', label: 'Spanish', nativeName: 'Español' },
    { value: 'fr', label: 'French', nativeName: 'Français' }
  ]
})
</script>

<style scoped>
.settings-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 60px);
}

.settings-header {
  margin-bottom: 2rem;
}

.settings-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 0.5rem;
}

.settings-description {
  color: var(--color-text-secondary);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: var(--color-danger);
  margin-bottom: 1rem;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section {
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 1.5rem;
}

.settings-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--color-heading);
}

.setting-item {
  margin-bottom: 1.5rem;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text);
}

.setting-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 1rem;
}

.setting-control:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-description {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

input[type="checkbox"] {
  margin-right: 0.5rem;
  width: auto;
}

input[type="range"] {
  cursor: pointer;
}

.account-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-email {
  font-weight: 500;
  color: var(--color-text);
}

.settings-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--color-border);
}

.settings-actions > div {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.unsaved-indicator {
  color: var(--color-warning);
  font-size: 0.875rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--color-background-mute);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-border);
}

.btn-danger {
  background: var(--color-danger);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

/* Toast notification styles */
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

.toast.success {
  background: var(--color-success);
  color: white;
}

.toast.error {
  background: var(--color-danger);
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .settings-view {
    padding: 1rem;
  }
  
  .settings-actions {
    flex-direction: column;
    gap: 1rem;
  }
  
  .settings-actions > div {
    width: 100%;
    justify-content: space-between;
  }
}