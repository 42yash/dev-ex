import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { query } from '../db/index.js'
import { getCached, setCached, deleteCached } from './redis.js'
import { logger } from '../utils/logger.js'

interface TokenPayload {
  id: string
  email: string
  role: string
  sessionId?: string
}

interface RefreshTokenData {
  userId: string
  tokenId: string
  expiresAt: Date
  deviceInfo?: string
}

// Token configuration
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRY || '15m'
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d'

// Convert expiry string to seconds
const parseExpiry = (expiry: string): number => {
  const unit = expiry.slice(-1)
  const value = parseInt(expiry.slice(0, -1))
  
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return 900 // 15 minutes default
  }
}

export class TokenService {
  // Generate access token
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'dev-ex',
      audience: 'dev-ex-api'
    })
  }
  
  // Generate refresh token
  static async generateRefreshToken(userId: string, deviceInfo?: string): Promise<string> {
    const tokenId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + parseExpiry(REFRESH_TOKEN_EXPIRY) * 1000)
    
    // Store refresh token in database
    await query(
      `INSERT INTO refresh_tokens (id, user_id, expires_at, device_info) 
       VALUES ($1, $2, $3, $4)`,
      [tokenId, userId, expiresAt, deviceInfo]
    )
    
    // Also cache for faster validation
    const cacheKey = `refresh_token:${tokenId}`
    await setCached(cacheKey, {
      userId,
      tokenId,
      expiresAt,
      deviceInfo
    } as RefreshTokenData, parseExpiry(REFRESH_TOKEN_EXPIRY))
    
    // Create JWT with token ID
    return jwt.sign({ tokenId, userId }, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'dev-ex'
    })
  }
  
  // Verify access token
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, ACCESS_TOKEN_SECRET, {
        issuer: 'dev-ex',
        audience: 'dev-ex-api'
      }) as TokenPayload
    } catch (error) {
      throw new Error('Invalid access token')
    }
  }
  
  // Verify and validate refresh token
  static async verifyRefreshToken(token: string): Promise<RefreshTokenData> {
    try {
      // Verify JWT signature
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
        issuer: 'dev-ex'
      }) as { tokenId: string; userId: string }
      
      // Check cache first
      const cacheKey = `refresh_token:${decoded.tokenId}`
      let tokenData = await getCached<RefreshTokenData>(cacheKey)
      
      if (!tokenData) {
        // Fallback to database
        const result = await query(
          `SELECT * FROM refresh_tokens 
           WHERE id = $1 AND user_id = $2 AND revoked = false`,
          [decoded.tokenId, decoded.userId]
        )
        
        if (!result[0]) {
          throw new Error('Refresh token not found or revoked')
        }
        
        tokenData = {
          userId: result[0].user_id,
          tokenId: result[0].id,
          expiresAt: result[0].expires_at,
          deviceInfo: result[0].device_info
        }
        
        // Re-cache
        await setCached(cacheKey, tokenData, 3600) // Cache for 1 hour
      }
      
      // Check expiration
      if (new Date(tokenData.expiresAt) < new Date()) {
        throw new Error('Refresh token expired')
      }
      
      return tokenData
    } catch (error) {
      logger.error('Refresh token verification failed:', error)
      throw new Error('Invalid refresh token')
    }
  }
  
  // Rotate refresh token (security best practice)
  static async rotateRefreshToken(oldToken: string, deviceInfo?: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    // Verify old token
    const tokenData = await this.verifyRefreshToken(oldToken)
    
    // Get user data
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [tokenData.userId]
    )
    
    if (!userResult[0]) {
      throw new Error('User not found')
    }
    
    const user = userResult[0]
    
    // Revoke old refresh token
    await this.revokeRefreshToken(tokenData.tokenId)
    
    // Generate new tokens
    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    })
    
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo)
    
    // Log token rotation for audit
    logger.info({
      userId: user.id,
      oldTokenId: tokenData.tokenId,
      event: 'token_rotation'
    }, 'Refresh token rotated')
    
    return { accessToken, refreshToken }
  }
  
  // Revoke refresh token
  static async revokeRefreshToken(tokenId: string): Promise<void> {
    // Update database
    await query(
      'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE id = $1',
      [tokenId]
    )
    
    // Remove from cache
    const cacheKey = `refresh_token:${tokenId}`
    await deleteCached(cacheKey)
  }
  
  // Revoke all refresh tokens for user (e.g., on password change)
  static async revokeAllUserTokens(userId: string): Promise<void> {
    // Get all active tokens
    const tokens = await query(
      'SELECT id FROM refresh_tokens WHERE user_id = $1 AND revoked = false',
      [userId]
    )
    
    // Revoke all tokens
    await query(
      'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE user_id = $1',
      [userId]
    )
    
    // Remove from cache
    for (const token of tokens) {
      const cacheKey = `refresh_token:${token.id}`
      await deleteCached(cacheKey)
    }
    
    logger.info({ userId, count: tokens.length }, 'Revoked all user refresh tokens')
  }
  
  // Clean up expired tokens (should be run periodically)
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await query(
      `DELETE FROM refresh_tokens 
       WHERE expires_at < NOW() OR (revoked = true AND revoked_at < NOW() - INTERVAL '7 days')
       RETURNING id`
    )
    
    const count = result.length
    if (count > 0) {
      logger.info({ count }, 'Cleaned up expired refresh tokens')
    }
    
    return count
  }
  
  // Validate token has not been used too recently (prevent replay attacks)
  static async checkTokenReplay(tokenId: string): Promise<boolean> {
    const replayKey = `token_replay:${tokenId}`
    const replayWindow = 5 // 5 seconds
    
    // Check if token was recently used
    const recentlyUsed = await getCached<boolean>(replayKey)
    if (recentlyUsed) {
      logger.warn({ tokenId }, 'Potential token replay attack detected')
      return false
    }
    
    // Mark token as recently used
    await setCached(replayKey, true, replayWindow)
    return true
  }
  
  // Get active sessions for user
  static async getUserSessions(userId: string): Promise<any[]> {
    return await query(
      `SELECT id, device_info, created_at, expires_at 
       FROM refresh_tokens 
       WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    )
  }
}

// Database schema for refresh tokens (add to migrations)
export const refreshTokenSchema = `
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    INDEX idx_user_tokens (user_id),
    INDEX idx_token_expiry (expires_at)
  );
`