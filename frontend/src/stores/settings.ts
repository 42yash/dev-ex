import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  aiModel: string
  temperature: number
  maxTokens: number
  enableLocalDocs: boolean
  enableWebSearch: boolean
  enableCustomSources: boolean
  customSettings: Record<string, any>
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'auto',
  language: 'en',
  aiModel: 'gemini',
  temperature: 0.7,
  maxTokens: 2048,
  enableLocalDocs: true,
  enableWebSearch: true,
  enableCustomSources: false,
  customSettings: {}
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings: Ref<UserSettings> = ref({ ...DEFAULT_SETTINGS })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasUnsavedChanges = ref(false)

  // API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

  // Computed
  const currentTheme = computed(() => {
    if (settings.value.theme === 'auto') {
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    }
    return settings.value.theme
  })

  // Actions
  async function fetchSettings() {
    loading.value = true
    error.value = null
    
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${API_BASE}/api/v1/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }

      const data = await response.json()
      if (data.success && data.settings) {
        settings.value = data.settings
        hasUnsavedChanges.value = false
        
        // Apply theme immediately
        applyTheme(currentTheme.value)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch settings'
      console.error('Error fetching settings:', err)
    } finally {
      loading.value = false
    }
  }

  async function saveSettings() {
    loading.value = true
    error.value = null
    
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${API_BASE}/api/v1/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings.value)
      })

      if (!response.ok) {
        throw new Error('Failed to save settings')
      }

      const data = await response.json()
      if (data.success) {
        hasUnsavedChanges.value = false
        
        // Show success notification (will be replaced with toast later)
        return { success: true, message: data.message || 'Settings saved successfully' }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save settings'
      console.error('Error saving settings:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function resetSettings() {
    loading.value = true
    error.value = null
    
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${API_BASE}/api/v1/settings/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to reset settings')
      }

      const data = await response.json()
      if (data.success && data.settings) {
        settings.value = data.settings
        hasUnsavedChanges.value = false
        
        // Apply theme immediately
        applyTheme(currentTheme.value)
        
        return { success: true, message: data.message || 'Settings reset to defaults' }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to reset settings'
      console.error('Error resetting settings:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function updateSetting<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) {
    settings.value[key] = value
    hasUnsavedChanges.value = true
    
    // Apply theme immediately if changed
    if (key === 'theme') {
      applyTheme(currentTheme.value)
    }
  }

  function applyTheme(theme: 'light' | 'dark') {
    // Remove existing theme classes
    document.documentElement.classList.remove('light', 'dark')
    
    // Add new theme class
    document.documentElement.classList.add(theme)
    
    // Store in localStorage for persistence across page reloads
    localStorage.setItem('theme', theme)
  }

  // Watch for system theme changes when auto mode is enabled
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (settings.value.theme === 'auto') {
        applyTheme(e.matches ? 'dark' : 'light')
      }
    })
  }

  // Initialize theme on load
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (savedTheme) {
    applyTheme(savedTheme)
  } else {
    applyTheme(currentTheme.value)
  }

  // Fetch available models
  async function fetchAvailableModels() {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return []

      const response = await fetch(`${API_BASE}/api/v1/settings/models`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        return data.models || []
      }
    } catch (err) {
      console.error('Error fetching models:', err)
    }
    return []
  }

  // Fetch supported languages
  async function fetchSupportedLanguages() {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/languages`)
      
      if (response.ok) {
        const data = await response.json()
        return data.languages || []
      }
    } catch (err) {
      console.error('Error fetching languages:', err)
    }
    return []
  }

  return {
    // State
    settings,
    loading,
    error,
    hasUnsavedChanges,
    
    // Computed
    currentTheme,
    
    // Actions
    fetchSettings,
    saveSettings,
    resetSettings,
    updateSetting,
    applyTheme,
    fetchAvailableModels,
    fetchSupportedLanguages
  }
})