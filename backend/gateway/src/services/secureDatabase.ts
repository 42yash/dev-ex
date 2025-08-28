import { Pool } from 'pg'
import { logger } from '../utils/logger.js'

// Secure database query builder
export class SecureDatabase {
  private pool: Pool
  
  constructor(pool: Pool) {
    this.pool = pool
  }
  
  // Execute parameterized query (safe from SQL injection)
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    // Validate query doesn't contain dangerous patterns
    this.validateQuery(text)
    
    // Log query for audit (without sensitive data)
    logger.debug({
      query: this.sanitizeQueryForLogging(text),
      paramCount: params?.length || 0
    }, 'Executing database query')
    
    try {
      const result = await this.pool.query(text, params)
      return result.rows
    } catch (error) {
      logger.error({ error, query: this.sanitizeQueryForLogging(text) }, 'Database query failed')
      throw error
    }
  }
  
  // Build safe WHERE clause from filters
  buildWhereClause(filters: Record<string, any>): { 
    clause: string
    params: any[]
  } {
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1
    
    for (const [key, value] of Object.entries(filters)) {
      // Validate column name (alphanumeric and underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        throw new Error(`Invalid column name: ${key}`)
      }
      
      if (value === null) {
        conditions.push(`${key} IS NULL`)
      } else if (value === undefined) {
        // Skip undefined values
        continue
      } else if (Array.isArray(value)) {
        // Handle IN clause
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ')
        conditions.push(`${key} IN (${placeholders})`)
        params.push(...value)
      } else if (typeof value === 'object' && value.operator) {
        // Handle complex operators
        const op = this.validateOperator(value.operator)
        conditions.push(`${key} ${op} $${paramIndex++}`)
        params.push(value.value)
      } else {
        // Simple equality
        conditions.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }
    
    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    }
  }
  
  // Build safe ORDER BY clause
  buildOrderByClause(sortBy?: string, sortOrder?: 'asc' | 'desc'): string {
    if (!sortBy) return ''
    
    // Validate sort column (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(sortBy)) {
      throw new Error(`Invalid sort column: ${sortBy}`)
    }
    
    const order = sortOrder?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    return `ORDER BY ${sortBy} ${order}`
  }
  
  // Build safe LIMIT/OFFSET clause
  buildPaginationClause(page: number = 1, limit: number = 20): {
    clause: string
    offset: number
  } {
    // Sanitize pagination values
    const safePage = Math.max(1, Math.floor(page))
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)))
    const offset = (safePage - 1) * safeLimit
    
    return {
      clause: `LIMIT ${safeLimit} OFFSET ${offset}`,
      offset
    }
  }
  
  // Safe table name validation
  validateTableName(tableName: string): string {
    // Only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`)
    }
    
    // Check against whitelist of allowed tables
    const allowedTables = [
      'users', 'sessions', 'messages', 'conversations',
      'refresh_tokens', 'api_keys', 'audit_logs',
      'user_settings', 'workflows', 'agents'
    ]
    
    if (!allowedTables.includes(tableName.toLowerCase())) {
      throw new Error(`Table not allowed: ${tableName}`)
    }
    
    return tableName
  }
  
  // Validate SQL operator
  private validateOperator(operator: string): string {
    const allowedOperators = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'NOT LIKE']
    const upperOp = operator.toUpperCase()
    
    if (!allowedOperators.includes(upperOp)) {
      throw new Error(`Invalid operator: ${operator}`)
    }
    
    return upperOp
  }
  
  // Validate query for dangerous patterns
  private validateQuery(query: string): void {
    const dangerousPatterns = [
      /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE)\s+/gi,
      /--.*$/gm,
      /\/\*[\s\S]*?\*\//g,
      /\bEXEC(UTE)?\s*\(/gi,
      /\bxp_cmdshell\b/gi,
      /\bINTO\s+OUTFILE\b/gi,
      /\bLOAD_FILE\s*\(/gi
    ]
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error('Query contains potentially dangerous SQL')
      }
    }
  }
  
  // Sanitize query for logging (remove sensitive data)
  private sanitizeQueryForLogging(query: string): string {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/api_key\s*=\s*'[^']*'/gi, "api_key='***'")
  }
  
  // Safe batch insert
  async batchInsert<T>(
    tableName: string,
    records: T[],
    returning?: string[]
  ): Promise<any[]> {
    if (!records || records.length === 0) {
      return []
    }
    
    const safeTable = this.validateTableName(tableName)
    const columns = Object.keys(records[0] as any)
    
    // Validate column names
    columns.forEach(col => {
      if (!/^[a-zA-Z0-9_]+$/.test(col)) {
        throw new Error(`Invalid column name: ${col}`)
      }
    })
    
    // Build query
    let paramIndex = 1
    const values: any[] = []
    const valuesClauses: string[] = []
    
    for (const record of records) {
      const placeholders = columns.map(() => `$${paramIndex++}`).join(', ')
      valuesClauses.push(`(${placeholders})`)
      values.push(...columns.map(col => (record as any)[col]))
    }
    
    let query = `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES ${valuesClauses.join(', ')}`
    
    if (returning && returning.length > 0) {
      // Validate returning columns
      returning.forEach(col => {
        if (!/^[a-zA-Z0-9_]+$/.test(col)) {
          throw new Error(`Invalid returning column: ${col}`)
        }
      })
      query += ` RETURNING ${returning.join(', ')}`
    }
    
    return await this.query(query, values)
  }
  
  // Safe update
  async update(
    tableName: string,
    updates: Record<string, any>,
    where: Record<string, any>
  ): Promise<number> {
    const safeTable = this.validateTableName(tableName)
    
    // Build SET clause
    const setClauses: string[] = []
    const params: any[] = []
    let paramIndex = 1
    
    for (const [key, value] of Object.entries(updates)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        throw new Error(`Invalid column name: ${key}`)
      }
      setClauses.push(`${key} = $${paramIndex++}`)
      params.push(value)
    }
    
    // Build WHERE clause
    const whereData = this.buildWhereClause(where)
    
    // Adjust parameter indices for WHERE clause
    const adjustedWhereClause = whereData.clause.replace(
      /\$(\d+)/g,
      (match, num) => `$${parseInt(num) + params.length}`
    )
    
    params.push(...whereData.params)
    
    const query = `UPDATE ${safeTable} SET ${setClauses.join(', ')} ${adjustedWhereClause}`
    const result = await this.pool.query(query, params)
    
    return result.rowCount || 0
  }
  
  // Transaction support
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
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
}

// Export singleton instance
let secureDb: SecureDatabase

export const initSecureDatabase = (pool: Pool) => {
  secureDb = new SecureDatabase(pool)
  return secureDb
}

export const getSecureDatabase = () => {
  if (!secureDb) {
    throw new Error('SecureDatabase not initialized')
  }
  return secureDb
}