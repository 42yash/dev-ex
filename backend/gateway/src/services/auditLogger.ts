import { query } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { getCached, setCached } from './redis'
import crypto from 'crypto'

export interface AuditEvent {
  id?: string
  eventType: string
  userId?: string
  ipAddress: string
  userAgent?: string
  resource?: string
  action: string
  result: 'success' | 'failure' | 'error'
  metadata?: Record<string, any>
  timestamp?: Date
}

export interface SecurityAlert {
  type: 'brute_force' | 'suspicious_activity' | 'data_breach' | 'unauthorized_access'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  userId?: string
  ipAddress?: string
  metadata?: Record<string, any>
}

export class AuditLogger {
  private static readonly BATCH_SIZE = 100
  private static readonly FLUSH_INTERVAL = 5000 // 5 seconds
  private static events: AuditEvent[] = []
  private static flushTimer: NodeJS.Timeout | null = null
  
  // Log audit event
  static async log(event: AuditEvent): Promise<void> {
    // Add event ID and timestamp
    event.id = crypto.randomUUID()
    event.timestamp = new Date()
    
    // Redact sensitive data from metadata
    if (event.metadata) {
      event.metadata = this.redactSensitiveData(event.metadata)
    }
    
    // Add to batch
    this.events.push(event)
    
    // Check if batch is full
    if (this.events.length >= this.BATCH_SIZE) {
      await this.flush()
    } else {
      // Schedule flush if not already scheduled
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL)
      }
    }
    
    // Log to application logger as well
    logger.info({
      auditEvent: event,
      category: 'audit'
    }, `Audit: ${event.eventType} - ${event.action}`)
    
    // Check for security patterns
    await this.checkSecurityPatterns(event)
  }
  
  // Flush events to database
  static async flush(): Promise<void> {
    if (this.events.length === 0) return
    
    const eventsToFlush = [...this.events]
    this.events = []
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    
    try {
      // Batch insert
      const values = eventsToFlush.map(event => [
        event.id,
        event.eventType,
        event.userId,
        event.ipAddress,
        event.userAgent,
        event.resource,
        event.action,
        event.result,
        event.metadata,
        event.timestamp
      ])
      
      const placeholders = values.map((_, i) => 
        `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`
      ).join(', ')
      
      const flatValues = values.flat()
      
      await query(
        `INSERT INTO audit_logs 
         (id, event_type, user_id, ip_address, user_agent, resource, action, result, metadata, timestamp)
         VALUES ${placeholders}`,
        flatValues
      )
    } catch (error) {
      logger.error({ error, eventCount: eventsToFlush.length }, 'Failed to flush audit events')
      // Re-add events to queue for retry
      this.events.unshift(...eventsToFlush)
    }
  }
  
  // Redact sensitive data
  private static redactSensitiveData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = [
      'password', 'token', 'api_key', 'secret', 'credit_card',
      'ssn', 'social_security', 'bank_account'
    ]
    
    const redacted = { ...data }
    
    for (const key in redacted) {
      // Check if field name contains sensitive keyword
      const lowerKey = key.toLowerCase()
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]'
      }
      // Recursively redact nested objects
      else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = this.redactSensitiveData(redacted[key])
      }
    }
    
    return redacted
  }
  
  // Check for security patterns
  private static async checkSecurityPatterns(event: AuditEvent): Promise<void> {
    // Check for brute force attempts
    if (event.eventType === 'auth_failure') {
      await this.checkBruteForce(event)
    }
    
    // Check for suspicious activity
    if (event.result === 'failure' || event.result === 'error') {
      await this.checkSuspiciousActivity(event)
    }
    
    // Check for data access patterns
    if (event.action.includes('export') || event.action.includes('download')) {
      await this.checkDataAccessPatterns(event)
    }
  }
  
  // Check for brute force attacks
  private static async checkBruteForce(event: AuditEvent): Promise<void> {
    const key = `brute_force:${event.ipAddress}`
    const window = 300 // 5 minutes
    
    // Get current count
    let count = await getCached<number>(key) || 0
    count++
    
    await setCached(key, count, window)
    
    // Alert if threshold exceeded
    if (count >= 10) {
      await this.raiseSecurityAlert({
        type: 'brute_force',
        severity: count >= 20 ? 'high' : 'medium',
        description: `Brute force attack detected from IP ${event.ipAddress}`,
        ipAddress: event.ipAddress,
        metadata: {
          attemptCount: count,
          resource: event.resource
        }
      })
    }
  }
  
  // Check for suspicious activity
  private static async checkSuspiciousActivity(event: AuditEvent): Promise<void> {
    const key = `suspicious:${event.ipAddress}:${event.userId || 'anonymous'}`
    const window = 3600 // 1 hour
    
    // Track failure patterns
    let failures = await getCached<string[]>(key) || []
    failures.push(`${event.eventType}:${event.action}`)
    
    // Keep only recent failures
    if (failures.length > 50) {
      failures = failures.slice(-50)
    }
    
    await setCached(key, failures, window)
    
    // Check for patterns
    const uniqueFailures = new Set(failures).size
    if (uniqueFailures >= 10) {
      await this.raiseSecurityAlert({
        type: 'suspicious_activity',
        severity: 'medium',
        description: 'Multiple different failed operations detected',
        userId: event.userId,
        ipAddress: event.ipAddress,
        metadata: {
          failureTypes: uniqueFailures,
          totalFailures: failures.length
        }
      })
    }
  }
  
  // Check data access patterns
  private static async checkDataAccessPatterns(event: AuditEvent): Promise<void> {
    if (!event.userId) return
    
    const key = `data_access:${event.userId}`
    const window = 3600 // 1 hour
    
    // Track data access
    let accesses = await getCached<number>(key) || 0
    accesses++
    
    await setCached(key, accesses, window)
    
    // Alert on unusual volume
    if (accesses >= 100) {
      await this.raiseSecurityAlert({
        type: 'suspicious_activity',
        severity: accesses >= 500 ? 'high' : 'medium',
        description: 'Unusual data access volume detected',
        userId: event.userId,
        metadata: {
          accessCount: accesses,
          action: event.action
        }
      })
    }
  }
  
  // Raise security alert
  private static async raiseSecurityAlert(alert: SecurityAlert): Promise<void> {
    logger.warn({
      securityAlert: alert,
      category: 'security'
    }, `Security Alert: ${alert.type} - ${alert.description}`)
    
    // Store alert in database
    await query(
      `INSERT INTO security_alerts 
       (id, type, severity, description, user_id, ip_address, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        crypto.randomUUID(),
        alert.type,
        alert.severity,
        alert.description,
        alert.userId,
        alert.ipAddress,
        alert.metadata
      ]
    )
    
    // TODO: Send notifications (email, Slack, etc.)
    // TODO: Trigger automated response (block IP, lock account, etc.)
  }
  
  // Query audit logs
  static async queryLogs(filters: {
    userId?: string
    ipAddress?: string
    eventType?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<AuditEvent[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1
    
    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`
      params.push(filters.userId)
    }
    
    if (filters.ipAddress) {
      query += ` AND ip_address = $${paramIndex++}`
      params.push(filters.ipAddress)
    }
    
    if (filters.eventType) {
      query += ` AND event_type = $${paramIndex++}`
      params.push(filters.eventType)
    }
    
    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`
      params.push(filters.startDate)
    }
    
    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`
      params.push(filters.endDate)
    }
    
    query += ' ORDER BY timestamp DESC'
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`
      params.push(filters.limit)
    }
    
    return await query(query, params)
  }
  
  // Get security alerts
  static async getSecurityAlerts(
    severity?: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 100
  ): Promise<any[]> {
    let queryStr = 'SELECT * FROM security_alerts'
    const params: any[] = []
    
    if (severity) {
      queryStr += ' WHERE severity = $1'
      params.push(severity)
    }
    
    queryStr += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1)
    params.push(limit)
    
    return await query(queryStr, params)
  }
  
  // Generate audit report
  static async generateReport(startDate: Date, endDate: Date): Promise<any> {
    // Get summary statistics
    const stats = await query(
      `SELECT 
        event_type,
        result,
        COUNT(*) as count
       FROM audit_logs
       WHERE timestamp BETWEEN $1 AND $2
       GROUP BY event_type, result`,
      [startDate, endDate]
    )
    
    // Get top users by activity
    const topUsers = await query(
      `SELECT 
        user_id,
        COUNT(*) as event_count
       FROM audit_logs
       WHERE timestamp BETWEEN $1 AND $2 AND user_id IS NOT NULL
       GROUP BY user_id
       ORDER BY event_count DESC
       LIMIT 10`,
      [startDate, endDate]
    )
    
    // Get security alerts
    const alerts = await query(
      `SELECT 
        type,
        severity,
        COUNT(*) as count
       FROM security_alerts
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY type, severity`,
      [startDate, endDate]
    )
    
    return {
      period: { startDate, endDate },
      statistics: stats,
      topUsers,
      securityAlerts: alerts,
      generatedAt: new Date()
    }
  }
}

// Database schemas
export const auditSchemas = `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    resource VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    result VARCHAR(20) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP NOT NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_ip (ip_address),
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_event_type (event_type)
  );
  
  CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_alert_severity (severity),
    INDEX idx_alert_type (type),
    INDEX idx_alert_created (created_at)
  );
`

// Ensure flush on shutdown
process.on('beforeExit', async () => {
  await AuditLogger.flush()
})