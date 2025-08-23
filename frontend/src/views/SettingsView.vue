<template>
  <div class="settings-view">
    <div class="settings-header">
      <h1>Settings</h1>
      <p class="settings-description">
        Configure your Dev-Ex platform preferences
      </p>
    </div>

    <div class="settings-container">
      <div class="settings-section">
        <h2>General Settings</h2>
        <div class="setting-item">
          <label class="setting-label">Theme</label>
          <select class="setting-control">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div class="setting-item">
          <label class="setting-label">Language</label>
          <select class="setting-control">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h2>AI Configuration</h2>
        <div class="setting-item">
          <label class="setting-label">Model</label>
          <select class="setting-control">
            <option value="gemini">Gemini Pro</option>
            <option value="gpt4">GPT-4</option>
            <option value="claude">Claude</option>
          </select>
        </div>
        <div class="setting-item">
          <label class="setting-label">Temperature</label>
          <input type="range" min="0" max="1" step="0.1" value="0.7" class="setting-control">
        </div>
        <div class="setting-item">
          <label class="setting-label">Max Tokens</label>
          <input type="number" value="2048" min="100" max="4096" class="setting-control">
        </div>
      </div>

      <div class="settings-section">
        <h2>Documentation Sources</h2>
        <div class="setting-item">
          <label class="setting-label">
            <input type="checkbox" checked> Enable Local Documentation
          </label>
        </div>
        <div class="setting-item">
          <label class="setting-label">
            <input type="checkbox" checked> Enable Web Search
          </label>
        </div>
        <div class="setting-item">
          <label class="setting-label">
            <input type="checkbox"> Enable Custom Sources
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
          <button class="btn btn-secondary" @click="resetSettings">Reset to Default</button>
          <button class="btn btn-primary" @click="saveSettings">Save Settings</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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

const saveSettings = () => {
  // TODO: Implement settings save logic
  console.log('Settings saved')
  alert('Settings saved successfully!')
}

const resetSettings = () => {
  // TODO: Implement settings reset logic
  console.log('Settings reset')
  alert('Settings reset to default!')
}

const goBack = () => {
  router.push('/chat')
}

const handleLogout = () => {
  // Clear all auth data
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  
  // Navigate to home
  router.push('/')
  
  // Optional: Force reload to clear any cached state
  setTimeout(() => {
    window.location.reload()
  }, 100)
}
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
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.settings-description {
  color: var(--text-secondary);
  font-size: 1rem;
}

.settings-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  padding: 2rem;
}

.settings-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}

.settings-section:last-of-type {
  border-bottom: none;
  margin-bottom: 1rem;
}

.settings-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.setting-item {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.setting-label {
  flex: 0 0 200px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-control {
  flex: 1;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 1rem;
  max-width: 300px;
  transition: all var(--transition-fast);
}

.setting-control:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
}

select.setting-control {
  cursor: pointer;
}

select.setting-control option {
  background: var(--bg-primary);
  color: var(--text-primary);
}

input[type="checkbox"] {
  margin-right: 0.5rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

input[type="range"] {
  padding: 0;
  accent-color: var(--accent);
}

input[type="range"]::-webkit-slider-thumb {
  background: var(--accent);
}

input[type="range"]::-moz-range-thumb {
  background: var(--accent);
}

.account-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.user-email {
  color: var(--text-primary);
  font-weight: 500;
}

.settings-actions {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

.settings-actions > div {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.btn-primary:hover {
  background: var(--accent-secondary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
  color: var(--text-primary);
}

.btn-danger {
  background: var(--error);
  color: white;
}

.btn-danger:hover {
  background: #ff2222;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 68, 68, 0.4);
}

@media (max-width: 768px) {
  .settings-view {
    padding: 1rem;
  }

  .setting-item {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-label {
    flex: none;
  }

  .setting-control {
    max-width: 100%;
  }

  .settings-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>