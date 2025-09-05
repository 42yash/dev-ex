import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client'

// Create metrics registry
export const metricsRegistry = new Registry()

// Collect default Node.js metrics
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'devex_gateway_'
})

// HTTP metrics
export const httpRequestsTotal = new Counter({
  name: 'devex_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry]
})

export const httpRequestDuration = new Histogram({
  name: 'devex_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [metricsRegistry]
})

// Authentication metrics
export const authAttempts = new Counter({
  name: 'devex_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'result'],
  registers: [metricsRegistry]
})

export const activeUsers = new Gauge({
  name: 'devex_active_users',
  help: 'Number of active users',
  registers: [metricsRegistry]
})

// Chat metrics
export const chatMessages = new Counter({
  name: 'devex_chat_messages_total',
  help: 'Total chat messages processed',
  labelNames: ['type', 'session_id'],
  registers: [metricsRegistry]
})

export const chatResponseTime = new Histogram({
  name: 'devex_chat_response_time_seconds',
  help: 'Chat AI response time',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry]
})

// Database metrics
export const dbQueries = new Counter({
  name: 'devex_db_queries_total',
  help: 'Total database queries',
  labelNames: ['operation', 'table'],
  registers: [metricsRegistry]
})

export const dbQueryDuration = new Histogram({
  name: 'devex_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [metricsRegistry]
})

export const dbConnections = new Gauge({
  name: 'devex_db_connections',
  help: 'Number of database connections',
  labelNames: ['state'],
  registers: [metricsRegistry]
})

// Redis metrics
export const redisOperations = new Counter({
  name: 'devex_redis_operations_total',
  help: 'Total Redis operations',
  labelNames: ['operation', 'result'],
  registers: [metricsRegistry]
})

export const redisCacheHits = new Counter({
  name: 'devex_redis_cache_hits_total',
  help: 'Redis cache hits',
  registers: [metricsRegistry]
})

export const redisCacheMisses = new Counter({
  name: 'devex_redis_cache_misses_total',
  help: 'Redis cache misses',
  registers: [metricsRegistry]
})

// Error metrics
export const errorCount = new Counter({
  name: 'devex_errors_total',
  help: 'Total errors',
  labelNames: ['type', 'code'],
  registers: [metricsRegistry]
})

// WebSocket metrics
export const wsConnections = new Gauge({
  name: 'devex_websocket_connections',
  help: 'Active WebSocket connections',
  registers: [metricsRegistry]
})

export const wsMessages = new Counter({
  name: 'devex_websocket_messages_total',
  help: 'Total WebSocket messages',
  labelNames: ['direction', 'type'],
  registers: [metricsRegistry]
})

// Rate limiting metrics
export const rateLimitHits = new Counter({
  name: 'devex_rate_limit_hits_total',
  help: 'Rate limit hits',
  labelNames: ['endpoint'],
  registers: [metricsRegistry]
})

// Business metrics
export const sessionsCreated = new Counter({
  name: 'devex_sessions_created_total',
  help: 'Total chat sessions created',
  registers: [metricsRegistry]
})

export const agentExecutions = new Counter({
  name: 'devex_agent_executions_total',
  help: 'Total agent executions',
  labelNames: ['agent', 'result'],
  registers: [metricsRegistry]
})

// Middleware for collecting HTTP metrics
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now()
    const route = req.route?.path || req.url
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode.toString()
      }
      
      httpRequestsTotal.inc(labels)
      httpRequestDuration.observe(labels, duration)
      
      // Track errors
      if (res.statusCode >= 400) {
        errorCount.inc({
          type: res.statusCode >= 500 ? 'server' : 'client',
          code: res.statusCode.toString()
        })
      }
    })
    
    next()
  }
}

// Helper functions for tracking metrics
export function trackAuthAttempt(type: 'login' | 'register' | 'refresh', success: boolean) {
  authAttempts.inc({
    type,
    result: success ? 'success' : 'failure'
  })
}

export function trackDatabaseQuery(operation: string, table: string, duration: number) {
  dbQueries.inc({ operation, table })
  dbQueryDuration.observe({ operation, table }, duration / 1000)
}

export function trackChatMessage(type: 'user' | 'ai', sessionId: string) {
  chatMessages.inc({ type, session_id: sessionId })
}

export function trackAgentExecution(agent: string, success: boolean) {
  agentExecutions.inc({
    agent,
    result: success ? 'success' : 'failure'
  })
}

// Export metrics endpoint handler
export async function getMetrics(): Promise<string> {
  return await metricsRegistry.metrics()
}

// Health check with metrics
export function getHealthMetrics() {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString()
  }
}