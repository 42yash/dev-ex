import { ref } from 'vue'

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: Date
  data?: any
  stack?: string
  component?: string
}

export interface Logger {
  debug: (message: string, data?: any) => void
  info: (message: string, data?: any) => void
  warn: (message: string, data?: any) => void
  error: (message: string, data?: any) => void
  getLogs: () => LogEntry[]
  clearLogs: () => void
  sendToServer: () => Promise<void>
}

// Store logs in memory (limited to prevent memory leaks)
const MAX_LOGS = 100
const logs = ref<LogEntry[]>([])

// Configuration
const config = {
  enableConsole: import.meta.env.DEV,
  enableServer: import.meta.env.PROD,
  serverEndpoint: '/api/v1/logs',
  batchSize: 10,
  flushInterval: 30000 // 30 seconds
}

// Batch for sending to server
let logBatch: LogEntry[] = []
let flushTimer: NodeJS.Timeout | null = null

export function useLogger(componentName?: string): Logger {
  const createLogEntry = (
    level: LogEntry['level'],
    message: string,
    data?: any
  ): LogEntry => {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      component: componentName,
      data
    }

    // Add stack trace for errors
    if (level === 'error' && data instanceof Error) {
      entry.stack = data.stack
    }

    return entry
  }

  const log = (level: LogEntry['level'], message: string, data?: any) => {
    const entry = createLogEntry(level, message, data)
    
    // Add to in-memory logs
    logs.value.push(entry)
    
    // Keep logs limited
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(-MAX_LOGS)
    }
    
    // Console logging in development
    if (config.enableConsole) {
      const consoleMethod = level === 'debug' ? 'log' : level
      console[consoleMethod](`[${componentName || 'App'}]`, message, data || '')
    }
    
    // Add to batch for server logging
    if (config.enableServer) {
      logBatch.push(entry)
      
      // Auto-flush if batch is full
      if (logBatch.length >= config.batchSize) {
        flushLogs()
      } else {
        // Schedule flush
        scheduleFlush()
      }
    }
    
    // Track errors in production
    if (level === 'error' && import.meta.env.PROD) {
      trackError(entry)
    }
  }

  const scheduleFlush = () => {
    if (flushTimer) return
    
    flushTimer = setTimeout(() => {
      flushLogs()
    }, config.flushInterval)
  }

  const flushLogs = async () => {
    if (logBatch.length === 0) return
    
    const batch = [...logBatch]
    logBatch = []
    
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    
    try {
      await sendLogsToServer(batch)
    } catch (error) {
      // Re-add failed logs to batch
      logBatch = [...batch, ...logBatch]
      console.error('Failed to send logs to server:', error)
    }
  }

  const sendLogsToServer = async (entries: LogEntry[]) => {
    const response = await fetch(config.serverEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        logs: entries,
        sessionId: getSessionId(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to send logs: ${response.statusText}`)
    }
  }

  const trackError = (entry: LogEntry) => {
    // Send to error tracking service (e.g., Sentry)
    if ((window as any).Sentry) {
      (window as any).Sentry.captureException(entry.data || new Error(entry.message), {
        level: 'error',
        extra: {
          component: entry.component,
          timestamp: entry.timestamp
        }
      })
    }
    
    // Track in analytics
    if ((window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: entry.message,
        fatal: false
      })
    }
  }

  const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('sessionId', sessionId)
    }
    return sessionId
  }

  return {
    debug: (message: string, data?: any) => log('debug', message, data),
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
    getLogs: () => logs.value,
    clearLogs: () => {
      logs.value = []
      logBatch = []
    },
    sendToServer: flushLogs
  }
}

// Global error handler setup
export function setupGlobalErrorHandlers() {
  const logger = useLogger('GlobalErrorHandler')
  
  // Vue error handler
  if (import.meta.env.PROD) {
    const app = (window as any).__VUE_APP__
    if (app) {
      app.config.errorHandler = (error: Error, instance: any, info: string) => {
        logger.error('Vue error', {
          error: error.message,
          stack: error.stack,
          component: instance?.$options.name || 'Unknown',
          info
        })
      }
    }
  }
  
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise
    })
  })
  
  // Global errors
  window.addEventListener('error', (event) => {
    logger.error('Global error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
  })
  
  // Network errors
  window.addEventListener('offline', () => {
    logger.warn('Network offline')
  })
  
  window.addEventListener('online', () => {
    logger.info('Network online')
  })
  
  // Performance issues
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 3000) {
          logger.warn('Slow resource', {
            name: entry.name,
            duration: entry.duration,
            type: entry.entryType
          })
        }
      }
    })
    
    observer.observe({ entryTypes: ['resource', 'navigation'] })
  }
}

// Auto-flush logs on page unload
window.addEventListener('beforeunload', () => {
  const logger = useLogger()
  logger.sendToServer()
})