import crypto from 'crypto'
import { query } from '../db/index.js'
import { getCached, setCached, deleteCached } from './redis'
import { logger } from '../utils/logger.js'

interface ApiKey {
  id: string
  userId: string
  key: string
  name: string
  permissions: string[]
  rateLimit?: number
  expiresAt?: Date
  lastUsedAt?: Date
  createdAt: Date
}

interface ApiKeyValidation {
  valid: boolean
  userId?: string
  permissions?: string[]
  rateLimit?: number
}

export class ApiKeyService {
  private static readonly KEY_PREFIX = 'devex_'
  private static readonly KEY_LENGTH = 32
  private static readonly CACHE_TTL = 3600 // 1 hour
  
  // Generate a new API key
  static generateApiKey(): string {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH)
    const key = randomBytes.toString('base64url')
    return `${this.KEY_PREFIX}${key}`
  }
  
  // Hash API key for storage
  private static hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }
  
  // Create new API key for user
  static async createApiKey(
    userId: string,
    name: string,
    permissions: string[] = ['read'],
    expiresInDays?: number
  ): Promise<{ key: string; id: string }> {
    const apiKey = this.generateApiKey()
    const hashedKey = this.hashApiKey(apiKey)
    const keyId = crypto.randomUUID()
    
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null
    
    // Store in database
    await query(
      `INSERT INTO api_keys (id, user_id, key_hash, name, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [keyId, userId, hashedKey, name, permissions, expiresAt]
    )
    
    // Log key creation
    logger.info({
      userId,
      keyId,
      name,
      permissions,
      event: 'api_key_created'
    }, 'API key created')
    
    // Return the unhashed key (only shown once)
    return { key: apiKey, id: keyId }
  }
  
  // Validate API key
  static async validateApiKey(key: string): Promise<ApiKeyValidation> {
    // Check format
    if (!key.startsWith(this.KEY_PREFIX)) {
      return { valid: false }
    }
    
    const hashedKey = this.hashApiKey(key)
    const cacheKey = `api_key:${hashedKey}`
    
    // Check cache first
    let keyData = await getCached<ApiKey>(cacheKey)
    
    if (!keyData) {
      // Query database
      const result = await query(
        `SELECT * FROM api_keys 
         WHERE key_hash = $1 AND revoked = false`,
        [hashedKey]
      )
      
      if (!result[0]) {
        return { valid: false }
      }
      
      keyData = {
        id: result[0].id,
        userId: result[0].user_id,
        key: hashedKey,
        name: result[0].name,
        permissions: result[0].permissions,
        rateLimit: result[0].rate_limit,
        expiresAt: result[0].expires_at,
        lastUsedAt: result[0].last_used_at,
        createdAt: result[0].created_at
      }
      
      // Cache for future requests
      await setCached(cacheKey, keyData, this.CACHE_TTL)
    }
    
    // Check expiration
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
      // Key expired, invalidate cache
      await deleteCached(cacheKey)
      return { valid: false }
    }
    
    // Update last used timestamp (async, don't wait)
    this.updateLastUsed(keyData.id).catch(err => 
      logger.error({ error: err, keyId: keyData?.id }, 'Failed to update API key last used')
    )
    
    return {
      valid: true,
      userId: keyData.userId,
      permissions: keyData.permissions,
      rateLimit: keyData.rateLimit
    }
  }
  
  // Update last used timestamp
  private static async updateLastUsed(keyId: string): Promise<void> {
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyId]
    )
  }
  
  // Rotate API key
  static async rotateApiKey(keyId: string, userId: string): Promise<string> {
    // Get existing key data
    const result = await query(
      'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2 AND revoked = false',
      [keyId, userId]
    )
    
    if (!result[0]) {
      throw new Error('API key not found or already revoked')
    }
    
    const oldKey = result[0]
    
    // Generate new key
    const newApiKey = this.generateApiKey()
    const newHashedKey = this.hashApiKey(newApiKey)
    
    // Start transaction
    const client = await query('BEGIN')
    try {
      // Revoke old key
      await query(
        'UPDATE api_keys SET revoked = true, revoked_at = NOW() WHERE id = $1',
        [keyId]
      )
      
      // Create new key with same permissions
      const newKeyId = crypto.randomUUID()
      await query(
        `INSERT INTO api_keys (id, user_id, key_hash, name, permissions, rate_limit, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newKeyId,
          userId,
          newHashedKey,
          `${oldKey.name} (rotated)`,
          oldKey.permissions,
          oldKey.rate_limit,
          oldKey.expires_at
        ]
      )
      
      await query('COMMIT')
      
      // Invalidate cache for old key
      const oldCacheKey = `api_key:${oldKey.key_hash}`
      await deleteCached(oldCacheKey)
      
      logger.info({
        userId,
        oldKeyId: keyId,
        newKeyId,
        event: 'api_key_rotated'
      }, 'API key rotated')
      
      return newApiKey
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  }
  
  // Revoke API key
  static async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const result = await query(
      `UPDATE api_keys 
       SET revoked = true, revoked_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND revoked = false
       RETURNING key_hash`,
      [keyId, userId]
    )
    
    if (result[0]) {
      // Invalidate cache
      const cacheKey = `api_key:${result[0].key_hash}`
      await deleteCached(cacheKey)
      
      logger.info({
        userId,
        keyId,
        event: 'api_key_revoked'
      }, 'API key revoked')
    }
  }
  
  // List user's API keys
  static async listUserApiKeys(userId: string): Promise<any[]> {
    return await query(
      `SELECT id, name, permissions, rate_limit, last_used_at, created_at, expires_at
       FROM api_keys
       WHERE user_id = $1 AND revoked = false
       ORDER BY created_at DESC`,
      [userId]
    )
  }
  
  // Check if user has permission
  static hasPermission(permissions: string[], required: string): boolean {
    // Admin has all permissions
    if (permissions.includes('admin')) {
      return true
    }
    
    // Check specific permission
    if (permissions.includes(required)) {
      return true
    }
    
    // Check wildcard permissions
    const parts = required.split(':')
    for (let i = parts.length; i > 0; i--) {
      const wildcardPerm = parts.slice(0, i).join(':') + ':*'
      if (permissions.includes(wildcardPerm)) {
        return true
      }
    }
    
    return false
  }
  
  // Clean up expired/revoked keys
  static async cleanupApiKeys(): Promise<number> {
    const result = await query(
      `DELETE FROM api_keys
       WHERE (expires_at < NOW()) 
          OR (revoked = true AND revoked_at < NOW() - INTERVAL '30 days')
       RETURNING id`
    )
    
    const count = result.length
    if (count > 0) {
      logger.info({ count }, 'Cleaned up expired/revoked API keys')
    }
    
    return count
  }
}

// Database schema for API keys
export const apiKeySchema = `
  CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    permissions TEXT[] DEFAULT ARRAY['read'],
    rate_limit INTEGER,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    INDEX idx_key_hash (key_hash),
    INDEX idx_user_keys (user_id),
    INDEX idx_key_expiry (expires_at)
  );
`

// Middleware for API key authentication
export const apiKeyAuth = async (request: any, reply: any) => {
  const apiKey = request.headers['x-api-key']
  
  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key required'
    })
  }
  
  const validation = await ApiKeyService.validateApiKey(apiKey)
  
  if (!validation.valid) {
    // Log invalid attempt
    logger.warn({
      ip: request.ip,
      path: request.url,
      event: 'invalid_api_key'
    }, 'Invalid API key attempt')
    
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired API key'
    })
  }
  
  // Add user info to request
  request.apiKey = {
    userId: validation.userId,
    permissions: validation.permissions,
    rateLimit: validation.rateLimit
  }
  
  return true
}