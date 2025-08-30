import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AuditLogger } from '../services/auditLogger.js'
import { SecurityCronJobs } from '../services/cronJobs.js'
import { getCached } from '../services/redis.js'
import { query } from '../db/index.js'
import { logger } from '../utils/logger.js'

// Validation schemas
const auditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  ipAddress: z.string().optional(),
  eventType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100)
})

const alertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

export const securityRoutes: FastifyPluginAsync = async (fastify) => {
  // Require admin role for all security endpoints
  fastify.addHook('preHandler', async (request, reply) => {
    await fastify.authenticate(request, reply)
    const user = (request as any).user
    
    if (user.role !== 'admin') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin access required'
      })
    }
  })
  
  // Get security dashboard summary
  fastify.get('/dashboard', async (request, reply) => {
    try {
      // Get cached weekly report
      const weeklyReport = await getCached('security:weekly_report')
      
      // Get recent security alerts
      const recentAlerts = await query(
        `SELECT * FROM security_alerts 
         WHERE resolved = false 
         ORDER BY created_at DESC 
         LIMIT 10`
      )
      
      // Get current threat level based on recent activity
      const threatMetrics = await query(`
        SELECT 
          COUNT(CASE WHEN result = 'failure' THEN 1 END) as failed_attempts,
          COUNT(CASE WHEN event_type = 'auth_failure' THEN 1 END) as auth_failures,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM audit_logs
        WHERE timestamp > NOW() - INTERVAL '1 hour'
      `)
      
      const metrics = threatMetrics[0]
      let threatLevel = 'low'
      if (metrics.failed_attempts > 100 || metrics.auth_failures > 50) {
        threatLevel = 'high'
      } else if (metrics.failed_attempts > 50 || metrics.auth_failures > 20) {
        threatLevel = 'medium'
      }
      
      // Get blocked IPs count
      const blockedIPs = await query(
        'SELECT COUNT(*) as count FROM blocked_ips WHERE blocked_until > NOW() OR blocked_until IS NULL'
      )
      
      // Get active sessions count
      const activeSessions = await query(
        'SELECT COUNT(*) as count FROM session_security WHERE is_active = true'
      )
      
      // Get API key usage stats
      const apiKeyStats = await query(`
        SELECT 
          COUNT(*) as total_keys,
          COUNT(CASE WHEN last_used_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recently_used
        FROM api_keys
        WHERE revoked = false
      `)
      
      return reply.send({
        summary: {
          threatLevel,
          blockedIPs: blockedIPs[0].count,
          activeSessions: activeSessions[0].count,
          unresolvedAlerts: recentAlerts.length,
          apiKeys: apiKeyStats[0]
        },
        recentAlerts,
        weeklyReport,
        lastUpdated: new Date()
      })
    } catch (error) {
      logger.error('Failed to get security dashboard:', error)
      return reply.status(500).send({
        error: 'Failed to retrieve security dashboard'
      })
    }
  })
  
  // Query audit logs
  fastify.get('/audit-logs', async (request, reply) => {
    try {
      const params = auditQuerySchema.parse(request.query)
      
      const logs = await AuditLogger.queryLogs({
        userId: params.userId,
        ipAddress: params.ipAddress,
        eventType: params.eventType,
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        endDate: params.endDate ? new Date(params.endDate) : undefined,
        limit: params.limit
      })
      
      return reply.send(logs)
    } catch (error) {
      logger.error('Failed to query audit logs:', error)
      return reply.status(500).send({
        error: 'Failed to query audit logs'
      })
    }
  })
  
  // Get security alerts
  fastify.get('/alerts', async (request, reply) => {
    try {
      const { severity, resolved } = request.query as any
      
      let queryStr = 'SELECT * FROM security_alerts WHERE 1=1'
      const params: any[] = []
      let paramIndex = 1
      
      if (severity) {
        alertSeveritySchema.parse(severity)
        queryStr += ` AND severity = $${paramIndex++}`
        params.push(severity)
      }
      
      if (resolved !== undefined) {
        queryStr += ` AND resolved = $${paramIndex++}`
        params.push(resolved === 'true')
      }
      
      queryStr += ' ORDER BY created_at DESC LIMIT 100'
      
      const alerts = await query(queryStr, params)
      return reply.send(alerts)
    } catch (error) {
      logger.error('Failed to get security alerts:', error)
      return reply.status(500).send({
        error: 'Failed to retrieve security alerts'
      })
    }
  })
  
  // Resolve security alert
  fastify.put('/alerts/:alertId/resolve', async (request, reply) => {
    try {
      const { alertId } = request.params as { alertId: string }
      const { notes } = request.body as { notes?: string }
      const user = (request as any).user
      
      await query(
        `UPDATE security_alerts 
         SET resolved = true, 
             resolved_at = NOW(), 
             resolved_by = $1,
             resolution_notes = $2
         WHERE id = $3`,
        [user.id, notes || null, alertId]
      )
      
      await AuditLogger.log({
        eventType: 'security_alert_resolved',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'security_alerts',
        action: 'resolve',
        result: 'success',
        metadata: { alertId, notes }
      })
      
      return reply.status(204).send()
    } catch (error) {
      logger.error('Failed to resolve security alert:', error)
      return reply.status(500).send({
        error: 'Failed to resolve security alert'
      })
    }
  })
  
  // Get blocked IPs
  fastify.get('/blocked-ips', async (request, reply) => {
    try {
      const blockedIPs = await query(
        `SELECT * FROM blocked_ips 
         WHERE blocked_until > NOW() OR blocked_until IS NULL 
         ORDER BY created_at DESC`
      )
      
      return reply.send(blockedIPs)
    } catch (error) {
      logger.error('Failed to get blocked IPs:', error)
      return reply.status(500).send({
        error: 'Failed to retrieve blocked IPs'
      })
    }
  })
  
  // Block an IP
  fastify.post('/block-ip', async (request, reply) => {
    try {
      const { ipAddress, reason, duration } = request.body as {
        ipAddress: string
        reason: string
        duration?: number // hours
      }
      const user = (request as any).user
      
      const blockedUntil = duration 
        ? new Date(Date.now() + duration * 60 * 60 * 1000)
        : null
      
      await query(
        `INSERT INTO blocked_ips (ip_address, reason, blocked_until, blocked_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ip_address) 
         DO UPDATE SET 
           reason = $2, 
           blocked_until = $3, 
           blocked_by = $4`,
        [ipAddress, reason, blockedUntil, user.id]
      )
      
      await AuditLogger.log({
        eventType: 'ip_blocked',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'blocked_ips',
        action: 'block',
        result: 'success',
        metadata: { targetIP: ipAddress, reason, duration }
      })
      
      return reply.status(201).send({
        message: 'IP blocked successfully',
        ipAddress,
        blockedUntil
      })
    } catch (error) {
      logger.error('Failed to block IP:', error)
      return reply.status(500).send({
        error: 'Failed to block IP'
      })
    }
  })
  
  // Unblock an IP
  fastify.delete('/blocked-ips/:ip', async (request, reply) => {
    try {
      const { ip } = request.params as { ip: string }
      const user = (request as any).user
      
      await query(
        'DELETE FROM blocked_ips WHERE ip_address = $1',
        [ip]
      )
      
      await AuditLogger.log({
        eventType: 'ip_unblocked',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'blocked_ips',
        action: 'unblock',
        result: 'success',
        metadata: { targetIP: ip }
      })
      
      return reply.status(204).send()
    } catch (error) {
      logger.error('Failed to unblock IP:', error)
      return reply.status(500).send({
        error: 'Failed to unblock IP'
      })
    }
  })
  
  // Get failed login attempts
  fastify.get('/login-attempts', async (request, reply) => {
    try {
      const { email, success } = request.query as any
      
      let queryStr = 'SELECT * FROM login_attempts WHERE 1=1'
      const params: any[] = []
      let paramIndex = 1
      
      if (email) {
        queryStr += ` AND email = $${paramIndex++}`
        params.push(email)
      }
      
      if (success !== undefined) {
        queryStr += ` AND success = $${paramIndex++}`
        params.push(success === 'true')
      }
      
      queryStr += ' ORDER BY created_at DESC LIMIT 100'
      
      const attempts = await query(queryStr, params)
      return reply.send(attempts)
    } catch (error) {
      logger.error('Failed to get login attempts:', error)
      return reply.status(500).send({
        error: 'Failed to retrieve login attempts'
      })
    }
  })
  
  // Get user security info
  fastify.get('/users/:userId/security', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string }
      
      // Get user security details
      const userSecurity = await query(
        `SELECT 
          u.id,
          u.email,
          u.two_factor_enabled,
          u.last_password_change,
          u.account_locked,
          u.lock_reason,
          u.locked_until,
          u.failed_login_attempts,
          u.last_failed_login
        FROM users u
        WHERE u.id = $1`,
        [userId]
      )
      
      if (!userSecurity[0]) {
        return reply.status(404).send({ error: 'User not found' })
      }
      
      // Get active sessions
      const sessions = await query(
        `SELECT * FROM session_security 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY last_activity DESC`,
        [userId]
      )
      
      // Get API keys
      const apiKeys = await query(
        `SELECT id, name, permissions, last_used_at, created_at 
         FROM api_keys 
         WHERE user_id = $1 AND revoked = false`,
        [userId]
      )
      
      // Get recent audit logs
      const recentActivity = await query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         ORDER BY timestamp DESC 
         LIMIT 20`,
        [userId]
      )
      
      return reply.send({
        user: userSecurity[0],
        activeSessions: sessions,
        apiKeys,
        recentActivity
      })
    } catch (error) {
      logger.error('Failed to get user security info:', error)
      return reply.status(500).send({
        error: 'Failed to retrieve user security info'
      })
    }
  })
  
  // Lock/unlock user account
  fastify.post('/users/:userId/lock', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string }
      const { lock, reason, duration } = request.body as {
        lock: boolean
        reason?: string
        duration?: number // hours
      }
      const admin = (request as any).user
      
      if (lock) {
        const lockedUntil = duration 
          ? new Date(Date.now() + duration * 60 * 60 * 1000)
          : null
        
        await query(
          `UPDATE users 
           SET account_locked = true, 
               lock_reason = $1, 
               locked_until = $2
           WHERE id = $3`,
          [reason || 'Manual lock by admin', lockedUntil, userId]
        )
      } else {
        await query(
          `UPDATE users 
           SET account_locked = false, 
               lock_reason = NULL, 
               locked_until = NULL,
               failed_login_attempts = 0
           WHERE id = $1`,
          [userId]
        )
      }
      
      await AuditLogger.log({
        eventType: lock ? 'account_locked' : 'account_unlocked',
        userId: admin.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'users',
        action: lock ? 'lock' : 'unlock',
        result: 'success',
        metadata: { targetUserId: userId, reason, duration }
      })
      
      return reply.send({
        message: `Account ${lock ? 'locked' : 'unlocked'} successfully`
      })
    } catch (error) {
      logger.error('Failed to lock/unlock account:', error)
      return reply.status(500).send({
        error: 'Failed to lock/unlock account'
      })
    }
  })
  
  // Get cron job status
  fastify.get('/cron-status', async (request, reply) => {
    try {
      const status = SecurityCronJobs.getStatus()
      return reply.send(status)
    } catch (error) {
      logger.error('Failed to get cron status:', error)
      return reply.status(500).send({
        error: 'Failed to retrieve cron job status'
      })
    }
  })
  
  // Run cron job manually
  fastify.post('/cron-run/:jobName', async (request, reply) => {
    try {
      const { jobName } = request.params as { jobName: string }
      const user = (request as any).user
      
      await SecurityCronJobs.runJob(jobName)
      
      await AuditLogger.log({
        eventType: 'cron_manual_run',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: 'cron_jobs',
        action: 'manual_run',
        result: 'success',
        metadata: { jobName }
      })
      
      return reply.send({
        message: `Job ${jobName} executed successfully`
      })
    } catch (error) {
      logger.error('Failed to run cron job:', error)
      return reply.status(500).send({
        error: 'Failed to run cron job',
        message: (error as Error).message
      })
    }
  })
}