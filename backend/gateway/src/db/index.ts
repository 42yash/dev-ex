import { Pool, PoolConfig, PoolClient } from 'pg'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

let pool: Pool | null = null

// Enhanced pool configuration with better defaults
const poolConfig: PoolConfig = {
  connectionString: config.database.url,
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum number of clients in pool
  min: parseInt(process.env.DB_POOL_MIN || '2'),  // Minimum number of clients in pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // Close idle clients after 30s
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // Timeout for new connections
  
  // Connection retry settings
  allowExitOnIdle: false, // Keep the pool alive even if all clients are idle
  
  // Statement timeout to prevent long-running queries
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30s query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30s query timeout
  
  // Enable SSL in production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // You may want to set this to true with proper certs
  } : false
}

// Track pool statistics
let poolStats = {
  totalConnections: 0,
  idleConnections: 0,
  waitingConnections: 0,
  activeQueries: 0
}

export async function initializeDatabase(): Promise<void> {
  try {
    pool = new Pool(poolConfig)
    
    // Set up pool event handlers
    pool.on('connect', (client) => {
      poolStats.totalConnections++
      logger.debug('New database client connected')
    })
    
    pool.on('acquire', (client) => {
      poolStats.activeQueries++
      logger.debug('Client acquired from pool')
    })
    
    pool.on('release', (client) => {
      poolStats.activeQueries--
      logger.debug('Client released back to pool')
    })
    
    pool.on('remove', (client) => {
      poolStats.totalConnections--
      logger.debug('Client removed from pool')
    })
    
    pool.on('error', (error, client) => {
      logger.error('Unexpected database pool error:', error)
    })
    
    // Test the connection
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()
    
    // Update pool stats periodically
    setInterval(() => {
      if (pool) {
        poolStats.idleConnections = pool.idleCount
        poolStats.waitingConnections = pool.waitingCount
        poolStats.totalConnections = pool.totalCount
        
        logger.debug('Database pool stats:', poolStats)
      }
    }, 30000) // Log stats every 30 seconds
    
    logger.info('Database connection pool initialized', {
      max: poolConfig.max,
      min: poolConfig.min,
      idleTimeout: poolConfig.idleTimeoutMillis
    })
  } catch (error) {
    logger.error('Failed to initialize database:', error)
    throw error
  }
}

export async function query<T = any>(
  text: string, 
  params?: any[], 
  retries: number = 2
): Promise<T[]> {
  if (!pool) {
    throw new Error('Database not initialized')
  }
  
  let lastError: any
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = Date.now()
    try {
      const res = await pool.query(text, params)
      const duration = Date.now() - start
      
      // Log slow queries
      if (duration > 1000) {
        logger.warn({
          query: text,
          duration,
          rows: res.rowCount
        }, 'Slow query detected')
      } else {
        logger.debug({
          query: text,
          duration,
          rows: res.rowCount
        }, 'Executed query')
      }
      
      return res.rows
    } catch (error: any) {
      lastError = error
      const duration = Date.now() - start
      
      // Check if error is retryable
      const isRetryable = error.code === 'ECONNREFUSED' || 
                         error.code === 'ETIMEDOUT' ||
                         error.code === '57P03' || // cannot_connect_now
                         error.code === '53300'    // too_many_connections
      
      if (isRetryable && attempt < retries) {
        logger.warn({
          query: text,
          error: error.message,
          attempt: attempt + 1,
          maxRetries: retries
        }, 'Query failed, retrying...')
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
        continue
      }
      
      logger.error({
        query: text,
        duration,
        error: error.message,
        code: error.code
      }, 'Query failed')
      break
    }
  }
  
  throw lastError
}

export async function getClient() {
  if (!pool) {
    throw new Error('Database not initialized')
  }
  return pool.connect()
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1')
    return result.length > 0
  } catch (error) {
    logger.error('Database health check failed:', error)
    return false
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    logger.info('Database connection closed')
  }
}

export function getPoolStats() {
  if (!pool) {
    return {
      ...poolStats,
      poolExists: false
    }
  }
  
  return {
    ...poolStats,
    poolExists: true,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  }
}

// Prepared statements for better performance
export async function prepareStatement(name: string, text: string, values: number) {
  if (!pool) {
    throw new Error('Database not initialized')
  }
  
  const client = await pool.connect()
  try {
    await client.query({
      name,
      text,
      values
    } as any)
    logger.debug(`Prepared statement '${name}' created`)
  } finally {
    client.release()
  }
}

// Export pool for use in other modules
export { pool }