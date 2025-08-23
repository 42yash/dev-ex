const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    // Get token from localStorage
    const token = localStorage.getItem('accessToken')
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || `HTTP ${response.status}`)
      }
      
      return response.json()
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

const apiClient = new ApiClient(API_BASE_URL)

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    apiClient.post<any>('/api/v1/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    apiClient.post<any>('/api/v1/auth/login', data),
  
  logout: () =>
    apiClient.post<any>('/api/v1/auth/logout'),
  
  refresh: (refreshToken: string) =>
    apiClient.post<any>('/api/v1/auth/refresh', { refreshToken }),
  
  getMe: () =>
    apiClient.get<any>('/api/v1/auth/me')
}

// Chat API
export const chatApi = {
  createSession: (data?: { title?: string; metadata?: any }) =>
    apiClient.post<any>('/api/v1/chat/session', data || {}),
  
  getSessions: (limit: number = 20, offset: number = 0) =>
    apiClient.get<any>(`/api/v1/chat/sessions?limit=${limit}&offset=${offset}`),
  
  sendMessage: (data: { sessionId?: string; message: string; options?: any }) =>
    apiClient.post<any>('/api/v1/chat/message', data),
  
  getHistory: (sessionId: string, limit: number = 50, offset: number = 0) =>
    apiClient.get<any>(`/api/v1/chat/history/${sessionId}?limit=${limit}&offset=${offset}`),
  
  deleteSession: (sessionId: string) =>
    apiClient.delete<any>(`/api/v1/chat/session/${sessionId}`)
}

// Health API
export const healthApi = {
  check: () =>
    apiClient.get<any>('/health'),
  
  ready: () =>
    apiClient.get<any>('/health/ready'),
  
  live: () =>
    apiClient.get<any>('/health/live')
}

export default apiClient