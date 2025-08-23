import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api'
import router from '@/router'
import { wsService } from '@/services/websocket'

export interface User {
  id: string
  email: string
  name?: string
  role: string
  createdAt?: string
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Load tokens from localStorage on init
  const storedAccessToken = localStorage.getItem('accessToken')
  const storedRefreshToken = localStorage.getItem('refreshToken')
  if (storedAccessToken) accessToken.value = storedAccessToken
  if (storedRefreshToken) refreshToken.value = storedRefreshToken

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value)

  // Actions
  async function register(email: string, password: string, name?: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await authApi.register({ email, password, name })
      
      user.value = response.user
      accessToken.value = response.accessToken
      refreshToken.value = response.refreshToken
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)
      
      // Connect WebSocket with new token
      wsService.connect()
      
      // Redirect to chat
      router.push('/chat')
      
      return response
    } catch (err: any) {
      error.value = err.message || 'Registration failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function login(email: string, password: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await authApi.login({ email, password })
      
      user.value = response.user
      accessToken.value = response.accessToken
      refreshToken.value = response.refreshToken
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)
      
      // Connect WebSocket with new token
      wsService.connect()
      
      // Redirect to chat
      router.push('/chat')
      
      return response
    } catch (err: any) {
      error.value = err.message || 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      // Call logout endpoint
      if (accessToken.value) {
        await authApi.logout()
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear local state regardless
      user.value = null
      accessToken.value = null
      refreshToken.value = null
      
      // Clear localStorage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      
      // Disconnect WebSocket
      wsService.disconnect()
      
      // Redirect to home
      router.push('/')
    }
  }

  async function refreshAccessToken() {
    try {
      if (!refreshToken.value) {
        throw new Error('No refresh token available')
      }
      
      const response = await authApi.refresh(refreshToken.value)
      
      accessToken.value = response.accessToken
      localStorage.setItem('accessToken', response.accessToken)
      
      return response.accessToken
    } catch (err) {
      // If refresh fails, logout
      await logout()
      throw err
    }
  }

  async function getCurrentUser() {
    try {
      if (!accessToken.value) {
        throw new Error('Not authenticated')
      }
      
      const response = await authApi.getMe()
      user.value = response.user
      
      return response.user
    } catch (err: any) {
      error.value = err.message || 'Failed to get user info'
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  // Auto-fetch user on init if authenticated
  if (isAuthenticated.value && !user.value) {
    getCurrentUser().catch(console.error)
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isLoading,
    error,
    
    // Getters
    isAuthenticated,
    
    // Actions
    register,
    login,
    logout,
    refreshAccessToken,
    getCurrentUser,
    clearError
  }
})