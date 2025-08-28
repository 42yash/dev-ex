import cron from 'node-cron'
import { TokenService } from './tokenService.js'
import { ApiKeyService } from './apiKeyService.js'
import { AuditLogger } from './auditLogger.js'
import { logger } from '../utils/logger.js'
import { query } from '../db/index.js'
import { getCached, setCached } from './redis.js'

interface CronJob {
  name: string
  schedule: string
  task: () => Promise<void>
  running: boolean
}

export class SecurityCronJobs {
  private static jobs: Map<string, cron.ScheduledTask> = new Map()
  private static isRunning: boolean = false
  
  // Job definitions
  private static jobDefinitions: CronJob[] = [
    {
      name: 'cleanup-expired-tokens',
      schedule: '0 */6 * * *', // Every 6 hours
      task: async () => {
        try {
          logger.info('Starting expired tokens cleanup')
          const count = await TokenService.cleanupExpiredTokens()
          logger.info(`Cleaned up ${count} expired refresh tokens`)
          
          await AuditLogger.log({
            eventType: 'maintenance',
            ipAddress: '127.0.0.1',
            action: 'cleanup_tokens',
            result: 'success',
            metadata: { tokensRemoved: count }
          })
        } catch (error) {
          logger.error('Failed to cleanup expired tokens:', error)
          await AuditLogger.log({
            eventType: 'maintenance',
            ipAddress: '127.0.0.1',
            action: 'cleanup_tokens',
            result: 'error',
            metadata: { error: (error as Error).message }
          })
        }
      },
      running: false
    },
    
    {
      name: 'cleanup-api-keys',
      schedule: '0 2 * * *', // Daily at 2 AM
      task: async () => {
        try {
          logger.info('Starting API keys cleanup')
          const count = await ApiKeyService.cleanupApiKeys()
          logger.info(`Cleaned up ${count} expired/revoked API keys`)
          
          await AuditLogger.log({
            eventType: 'maintenance',
            ipAddress: '127.0.0.1',
            action: 'cleanup_api_keys',
            result: 'success',
            metadata: { keysRemoved: count }
          })
        } catch (error) {
          logger.error('Failed to cleanup API keys:', error)
          await AuditLogger.log({
            eventType: 'maintenance',
            ipAddress: '127.0.0.1',
            action: 'cleanup_api_keys',
            result: 'error',
            metadata: { error: (error as Error).message }
          })
        }
      },
      running: false
    },
    
    {
      name: 'cleanup-old-audit-logs',
      schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
      task: async () => {
        try {
          logger.info('Starting audit logs cleanup')
          
          // Keep audit logs for 1 year
          const result = await query(
            `DELETE FROM audit_logs 
             WHERE timestamp < NOW() - INTERVAL '1 year'
             RETURNING id`
          )
          
          const count = result.length
          logger.info(`Cleaned up ${count} old audit logs`)
          
          // Don't log audit cleanup to avoid recursion
        } catch (error) {
          logger.error('Failed to cleanup audit logs:', error)
        }
      },
      running: false
    },
    
    {
      name: 'cleanup-rate-limits',
      schedule: '*/15 * * * *', // Every 15 minutes
      task: async () => {
        try {
          // Clean expired rate limit tracking
          const result = await query(
            `DELETE FROM rate_limit_tracking 
             WHERE window_end < NOW()
             RETURNING id`
          )
          
          if (result.length > 0) {
            logger.debug(`Cleaned up ${result.length} expired rate limit records`)
          }
        } catch (error) {
          logger.error('Failed to cleanup rate limits:', error)
        }
      },
      running: false
    },
    
    {
      name: 'cleanup-login-attempts',
      schedule: '0 4 * * *', // Daily at 4 AM
      task: async () => {
        try {
          logger.info('Starting login attempts cleanup')
          
          // Keep login attempts for 30 days
          const result = await query(
            `DELETE FROM login_attempts 
             WHERE created_at < NOW() - INTERVAL '30 days'
             RETURNING id`
          )
          
          const count = result.length
          logger.info(`Cleaned up ${count} old login attempts`)
        } catch (error) {
          logger.error('Failed to cleanup login attempts:', error)
        }
      },
      running: false
    },
    
    {
      name: 'unlock-expired-accounts',
      schedule: '*/5 * * * *', // Every 5 minutes
      task: async () => {
        try {
          // Unlock accounts where lock has expired
          const result = await query(
            `UPDATE users 
             SET account_locked = false, 
                 lock_reason = NULL, 
                 locked_until = NULL,
                 failed_login_attempts = 0
             WHERE account_locked = true 
               AND locked_until IS NOT NULL 
               AND locked_until < NOW()
             RETURNING id, email`
          )
          
          if (result.length > 0) {
            logger.info(`Unlocked ${result.length} expired account locks`)
            
            for (const user of result) {
              await AuditLogger.log({
                eventType: 'account_unlocked',
                userId: user.id,
                ipAddress: '127.0.0.1',
                action: 'auto_unlock',
                result: 'success',
                metadata: { email: user.email }
              })
            }
          }
        } catch (error) {
          logger.error('Failed to unlock expired accounts:', error)
        }
      },
      running: false
    },
    
    {
      name: 'security-report',
      schedule: '0 9 * * 1', // Weekly on Monday at 9 AM
      task: async () => {
        try {
          logger.info('Generating weekly security report')
          
          const endDate = new Date()
          const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
          
          const report = await AuditLogger.generateReport(startDate, endDate)
          
          // Cache the report for dashboard access
          await setCached('security:weekly_report', report, 7 * 24 * 60 * 60) // 7 days
          
          logger.info('Weekly security report generated', report)
          
          // TODO: Send report via email to admins
        } catch (error) {
          logger.error('Failed to generate security report:', error)
        }
      },
      running: false
    },
    
    {
      name: 'cleanup-blocked-ips',
      schedule: '*/30 * * * *', // Every 30 minutes
      task: async () => {
        try {
          // Remove expired IP blocks
          const result = await query(
            `DELETE FROM blocked_ips 
             WHERE blocked_until IS NOT NULL 
               AND blocked_until < NOW()
             RETURNING ip_address`
          )
          
          if (result.length > 0) {
            logger.info(`Removed ${result.length} expired IP blocks`)
            
            for (const row of result) {
              await AuditLogger.log({
                eventType: 'ip_unblocked',
                ipAddress: row.ip_address,
                action: 'auto_unblock',
                result: 'success'
              })
            }
          }
        } catch (error) {
          logger.error('Failed to cleanup blocked IPs:', error)
        }
      },
      running: false
    },
    
    {
      name: 'cleanup-sessions',
      schedule: '0 */2 * * *', // Every 2 hours
      task: async () => {
        try {
          logger.info('Starting session cleanup')
          
          // Clean expired sessions
          const result = await query(
            `UPDATE session_security 
             SET is_active = false 
             WHERE is_active = true 
               AND (expires_at < NOW() 
                    OR last_activity < NOW() - INTERVAL '30 minutes')
             RETURNING id`
          )
          
          if (result.length > 0) {
            logger.info(`Deactivated ${result.length} expired sessions`)
          }
          
          // Delete old inactive sessions
          const deleted = await query(
            `DELETE FROM session_security 
             WHERE is_active = false 
               AND created_at < NOW() - INTERVAL '7 days'
             RETURNING id`
          )
          
          if (deleted.length > 0) {
            logger.info(`Deleted ${deleted.length} old inactive sessions`)
          }
        } catch (error) {
          logger.error('Failed to cleanup sessions:', error)
        }
      },
      running: false
    },
    
    {
      name: 'password-history-cleanup',
      schedule: '0 5 * * *', // Daily at 5 AM
      task: async () => {
        try {
          // Keep only last 10 passwords per user
          const result = await query(`
            DELETE FROM password_history 
            WHERE id IN (
              SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                  PARTITION BY user_id 
                  ORDER BY created_at DESC
                ) as rn
                FROM password_history
              ) t WHERE rn > 10
            )
            RETURNING id
          `)
          
          if (result.length > 0) {
            logger.info(`Cleaned up ${result.length} old password history entries`)
          }
        } catch (error) {
          logger.error('Failed to cleanup password history:', error)
        }
      },
      running: false
    }
  ]
  
  // Start all cron jobs
  static start(): void {
    if (this.isRunning) {
      logger.warn('Security cron jobs are already running')
      return
    }
    
    logger.info('Starting security cron jobs')
    
    for (const jobDef of this.jobDefinitions) {
      const task = cron.schedule(jobDef.schedule, async () => {
        if (jobDef.running) {
          logger.warn(`Job ${jobDef.name} is still running, skipping this execution`)
          return
        }
        
        jobDef.running = true
        try {
          await jobDef.task()
        } catch (error) {
          logger.error(`Error in cron job ${jobDef.name}:`, error)
        } finally {
          jobDef.running = false
        }
      }, {
        scheduled: false
      })
      
      task.start()
      this.jobs.set(jobDef.name, task)
      logger.info(`Started cron job: ${jobDef.name} (${jobDef.schedule})`)
    }
    
    this.isRunning = true
  }
  
  // Stop all cron jobs
  static stop(): void {
    if (!this.isRunning) {
      return
    }
    
    logger.info('Stopping security cron jobs')
    
    for (const [name, task] of this.jobs) {
      task.stop()
      logger.info(`Stopped cron job: ${name}`)
    }
    
    this.jobs.clear()
    this.isRunning = false
  }
  
  // Run a specific job manually
  static async runJob(jobName: string): Promise<void> {
    const jobDef = this.jobDefinitions.find(j => j.name === jobName)
    
    if (!jobDef) {
      throw new Error(`Job ${jobName} not found`)
    }
    
    if (jobDef.running) {
      throw new Error(`Job ${jobName} is already running`)
    }
    
    logger.info(`Manually running job: ${jobName}`)
    await jobDef.task()
  }
  
  // Get job status
  static getStatus(): any {
    return {
      isRunning: this.isRunning,
      jobs: this.jobDefinitions.map(job => ({
        name: job.name,
        schedule: job.schedule,
        running: job.running,
        active: this.jobs.has(job.name)
      }))
    }
  }
}

// Export for use in main server
export const startSecurityCronJobs = () => SecurityCronJobs.start()
export const stopSecurityCronJobs = () => SecurityCronJobs.stop()