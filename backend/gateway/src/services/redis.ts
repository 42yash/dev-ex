import { Redis } from 'ioredis'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

let redis: Redis | null = null

export async function initializeRedis(): Promise<void> {
  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        return targetErrors.some(e => err.message.includes(e))
      }
    })

    redis.on('connect', () => {
      logger.info('Redis connected')
    })

    redis.on('error', (err: any) => {
      logger.error('Redis error:', err)
    })

    redis.on('ready', () => {
      logger.info('Redis ready')
    })

    // Test connection
    await redis.ping()
  } catch (error) {
    logger.error('Failed to initialize Redis:', error)
    throw error
  }
}

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not initialized')
  }
  return redis
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redis) return false
    const result = await redis.ping()
    return result === 'PONG'
  } catch (error) {
    logger.error('Redis health check failed:', error)
    return false
  }
}

// Cache operations
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const data = await getRedis().get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    logger.error(`Failed to get cached value for ${key}:`, error)
    return null
  }
}

export async function setCached<T>(
  key: string, 
  value: T, 
  ttl?: number
): Promise<void> {
  try {
    const data = JSON.stringify(value)
    if (ttl) {
      await getRedis().setex(key, ttl, data)
    } else {
      await getRedis().set(key, data)
    }
  } catch (error) {
    logger.error(`Failed to set cached value for ${key}:`, error)
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    await getRedis().del(key)
  } catch (error) {
    logger.error(`Failed to delete cached value for ${key}:`, error)
  }
}

// Session management
export async function getSession(sessionId: string): Promise<any> {
  return getCached(`session:${sessionId}`)
}

export async function setSession(
  sessionId: string, 
  data: any, 
  ttl: number = 86400
): Promise<void> {
  return setCached(`session:${sessionId}`, data, ttl)
}

export async function deleteSession(sessionId: string): Promise<void> {
  return deleteCached(`session:${sessionId}`)
}

// Rate limiting
export async function checkRateLimit(
  key: string, 
  limit: number, 
  window: number
): Promise<boolean> {
  const redis = getRedis()
  const multi = redis.multi()
  const now = Date.now()
  const windowStart = now - window * 1000
  
  const redisKey = `rate:${key}`
  
  // Remove old entries
  multi.zremrangebyscore(redisKey, '-inf', windowStart)
  
  // Count current entries
  multi.zcard(redisKey)
  
  // Add current request
  multi.zadd(redisKey, now, `${now}-${Math.random()}`)
  
  // Set expiry
  multi.expire(redisKey, window)
  
  const results = await multi.exec()
  if (!results) return false
  
  const count = results[1]?.[1] as number
  return count < limit
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
    logger.info('Redis connection closed')
  }
}