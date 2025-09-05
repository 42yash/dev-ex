import pino from 'pino'
import { config } from '../config/index.js'
import { randomUUID } from 'crypto'

// Logging levels
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Log context interface
export interface LogContext {
  requestId?: string
  userId?: string
  sessionId?: string
  traceId?: string
  spanId?: string
  service?: string
  component?: string
  [key: string]: any
}

// Performance tracking
export interface PerformanceMetrics {
  duration?: number
  startTime?: number
  endTime?: number
  memoryUsage?: NodeJS.MemoryUsage
  cpuUsage?: NodeJS.CpuUsage
}

// Create base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: config.log?.level || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'api-gateway',
      environment: config.app.env
    })
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'x-request-id': req.headers['x-request-id']
      },
      remoteAddress: req.ip
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders()
    }),
    err: pino.stdSerializers.err
  },
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      '*.password',
      '*.token',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers.cookie'
    ],
    censor: '[REDACTED]'
  }
}

// Development pretty printing
if (config.app.env === 'development') {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname'
    }
  }
}

// Create the base logger
const baseLogger = pino(loggerConfig)

// Structured logger class
export class StructuredLogger {
  private logger: pino.Logger
  private context: LogContext
  private requestId: string

  constructor(component?: string, context?: LogContext) {
    this.requestId = context?.requestId || randomUUID()
    this.context = {
      component: component || 'default',
      requestId: this.requestId,
      ...context
    }
    this.logger = baseLogger.child(this.context)
  }

  // Core logging methods
  trace(message: string, data?: any) {
    this.logger.trace(this.enrichData(data), message)
  }

  debug(message: string, data?: any) {
    this.logger.debug(this.enrichData(data), message)
  }

  info(message: string, data?: any) {
    this.logger.info(this.enrichData(data), message)
  }

  warn(message: string, data?: any) {
    this.logger.warn(this.enrichData(data), message)
  }

  error(message: string, error?: Error | any, data?: any) {
    if (error instanceof Error) {
      this.logger.error({ ...this.enrichData(data), err: error }, message)
    } else {
      this.logger.error(this.enrichData({ ...data, error }), message)
    }
  }

  fatal(message: string, error?: Error | any, data?: any) {
    if (error instanceof Error) {
      this.logger.fatal({ ...this.enrichData(data), err: error }, message)
    } else {
      this.logger.fatal(this.enrichData({ ...data, error }), message)
    }
  }

  // Specialized logging methods
  http(req: any, res: any, responseTime?: number) {
    this.logger.info({
      ...this.enrichData({
        req,
        res,
        responseTime,
        type: 'http'
      })
    }, `${req.method} ${req.url} ${res.statusCode}`)
  }

  database(operation: string, query: string, duration: number, result?: any) {
    const data = {
      type: 'database',
      operation,
      query: this.sanitizeQuery(query),
      duration,
      rowCount: result?.rowCount
    }
    
    if (duration > 1000) {
      this.warn('Slow database query', data)
    } else {
      this.debug('Database query executed', data)
    }
  }

  security(event: string, data?: any) {
    this.logger.warn({
      ...this.enrichData(data),
      type: 'security',
      event
    }, `Security event: ${event}`)
  }

  audit(action: string, userId: string, data?: any) {
    this.logger.info({
      ...this.enrichData(data),
      type: 'audit',
      action,
      userId,
      timestamp: new Date().toISOString()
    }, `Audit: ${action} by user ${userId}`)
  }

  performance(operation: string, metrics: PerformanceMetrics) {
    const data = {
      type: 'performance',
      operation,
      ...metrics
    }
    
    if (metrics.duration && metrics.duration > 3000) {
      this.warn('Slow operation', data)
    } else {
      this.debug('Performance metrics', data)
    }
  }

  // Helper methods
  private enrichData(data?: any): any {
    return {
      ...this.context,
      timestamp: new Date().toISOString(),
      ...data
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='[REDACTED]'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='[REDACTED]'")
      .replace(/apikey\s*=\s*'[^']*'/gi, "apikey='[REDACTED]'")
  }

  // Create child logger with additional context
  child(context: LogContext): StructuredLogger {
    return new StructuredLogger(this.context.component as string, {
      ...this.context,
      ...context
    })
  }

  // Update context
  setContext(context: LogContext) {
    this.context = { ...this.context, ...context }
    this.logger = baseLogger.child(this.context)
  }

  // Get request ID
  getRequestId(): string {
    return this.requestId
  }

  // Async context tracking
  async withContext<T>(context: LogContext, fn: () => Promise<T>): Promise<T> {
    const childLogger = this.child(context)
    const startTime = Date.now()
    
    try {
      childLogger.debug('Operation started')
      const result = await fn()
      childLogger.debug('Operation completed', {
        duration: Date.now() - startTime
      })
      return result
    } catch (error) {
      childLogger.error('Operation failed', error as Error, {
        duration: Date.now() - startTime
      })
      throw error
    }
  }

  // Measure performance
  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now()
    const startCpu = process.cpuUsage()
    const startMem = process.memoryUsage()
    
    try {
      const result = await fn()
      
      const endTime = Date.now()
      const endCpu = process.cpuUsage(startCpu)
      const endMem = process.memoryUsage()
      
      this.performance(operation, {
        duration: endTime - startTime,
        startTime,
        endTime,
        cpuUsage: endCpu,
        memoryUsage: {
          rss: endMem.rss - startMem.rss,
          heapTotal: endMem.heapTotal - startMem.heapTotal,
          heapUsed: endMem.heapUsed - startMem.heapUsed,
          external: endMem.external - startMem.external,
          arrayBuffers: endMem.arrayBuffers - startMem.arrayBuffers
        }
      })
      
      return result
    } catch (error) {
      this.error(`Operation ${operation} failed`, error as Error)
      throw error
    }
  }
}

// Export singleton instance for general use
export const logger = new StructuredLogger('gateway')

// Middleware for request logging
export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const requestId = req.headers['x-request-id'] || randomUUID()
    const requestLogger = new StructuredLogger('http-request', {
      requestId,
      userId: req.user?.id,
      sessionId: req.session?.id
    })
    
    // Attach logger to request
    req.logger = requestLogger
    req.id = requestId
    
    // Set request ID header
    res.setHeader('X-Request-ID', requestId)
    
    // Log request
    requestLogger.debug('Incoming request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query
    })
    
    // Track response
    const startTime = Date.now()
    const originalSend = res.send
    
    res.send = function(data: any) {
      res.send = originalSend
      res.send(data)
      
      const responseTime = Date.now() - startTime
      requestLogger.http(req, res, responseTime)
      
      // Log slow requests
      if (responseTime > 1000) {
        requestLogger.warn('Slow request', {
          responseTime,
          method: req.method,
          url: req.url
        })
      }
    }
    
    next()
  }
}