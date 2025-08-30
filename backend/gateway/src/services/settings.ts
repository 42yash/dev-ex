import { query } from '../db/index.js'
import { getRedis } from './redis.js'
import { logger } from '../utils/logger.js'

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  aiModel: string
  temperature: number
  maxTokens: number
  enableLocalDocs: boolean
  enableWebSearch: boolean
  enableCustomSources: boolean
  customSettings: Record<string, any>
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'auto',
  language: 'en',
  aiModel: 'gemini',
  temperature: 0.7,
  maxTokens: 2048,
  enableLocalDocs: true,
  enableWebSearch: true,
  enableCustomSources: false,
  customSettings: {}
}

class SettingsService {
  private readonly CACHE_PREFIX = 'settings:'
  private readonly CACHE_TTL = 3600 // 1 hour

  async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${userId}`
      const cached = await getRedis().get(cacheKey)
      
      if (cached) {
        logger.debug(`Settings cache hit for user ${userId}`)
        return JSON.parse(cached)
      }

      // Query database
      const result = await query(
        `SELECT settings FROM users WHERE id = $1`,
        [userId]
      )

      let settings: UserSettings
      
      if (result.length > 0 && result[0].settings) {
        // Merge saved settings with defaults to ensure all fields exist
        settings = {
          ...DEFAULT_SETTINGS,
          ...result[0].settings
        }
      } else {
        // Use default settings
        settings = { ...DEFAULT_SETTINGS }
        
        // Save defaults to database for new users
        await this.saveSettingsToDatabase(userId, settings)
      }

      // Cache the settings
      await getRedis().setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(settings)
      )

      return settings
    } catch (error) {
      logger.error('Error fetching user settings:', error)
      // Return defaults on error
      return { ...DEFAULT_SETTINGS }
    }
  }

  async updateUserSettings(
    userId: string,
    updates: Partial<UserSettings>
  ): Promise<UserSettings> {
    try {
      // Get current settings
      const currentSettings = await this.getUserSettings(userId)
      
      // Merge updates
      const newSettings: UserSettings = {
        ...currentSettings,
        ...updates
      }

      // Validate settings
      this.validateSettings(newSettings)

      // Save to database
      await this.saveSettingsToDatabase(userId, newSettings)

      // Update cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`
      await getRedis().setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(newSettings)
      )

      logger.info(`Settings updated for user ${userId}`, {
        updates: Object.keys(updates)
      })

      return newSettings
    } catch (error) {
      logger.error('Error updating user settings:', error)
      throw new Error('Failed to update settings')
    }
  }

  async resetToDefaults(userId: string): Promise<UserSettings> {
    try {
      const settings = { ...DEFAULT_SETTINGS }
      
      // Save to database
      await this.saveSettingsToDatabase(userId, settings)

      // Clear cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`
      await getRedis().del(cacheKey)

      logger.info(`Settings reset to defaults for user ${userId}`)

      return settings
    } catch (error) {
      logger.error('Error resetting settings:', error)
      throw new Error('Failed to reset settings')
    }
  }

  async getAvailableModels(): Promise<Array<{
    value: string
    label: string
    description: string
    available: boolean
  }>> {
    // In production, this would check actual model availability
    return [
      {
        value: 'gemini',
        label: 'Gemini Pro',
        description: 'Google\'s advanced language model',
        available: true
      },
      {
        value: 'gpt4',
        label: 'GPT-4',
        description: 'OpenAI\'s most capable model',
        available: false // Requires API key configuration
      },
      {
        value: 'claude',
        label: 'Claude',
        description: 'Anthropic\'s helpful AI assistant',
        available: false // Requires API key configuration
      }
    ]
  }

  private async saveSettingsToDatabase(
    userId: string,
    settings: UserSettings
  ): Promise<void> {
    await query(
      `UPDATE users 
       SET settings = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [JSON.stringify(settings), userId]
    )
  }

  private validateSettings(settings: UserSettings): void {
    // Validate temperature
    if (settings.temperature < 0 || settings.temperature > 1) {
      throw new Error('Temperature must be between 0 and 1')
    }

    // Validate max tokens
    if (settings.maxTokens < 100 || settings.maxTokens > 4096) {
      throw new Error('Max tokens must be between 100 and 4096')
    }

    // Validate theme
    if (!['light', 'dark', 'auto'].includes(settings.theme)) {
      throw new Error('Invalid theme selection')
    }

    // Validate language
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh']
    if (!supportedLanguages.includes(settings.language)) {
      throw new Error('Unsupported language')
    }

    // Validate AI model
    const supportedModels = ['gemini', 'gpt4', 'claude']
    if (!supportedModels.includes(settings.aiModel)) {
      throw new Error('Unsupported AI model')
    }
  }

  async clearUserCache(userId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}`
    await getRedis().del(cacheKey)
  }

  async applySettingsToSession(
    userId: string,
    sessionId: string
  ): Promise<void> {
    // Get user settings
    const settings = await this.getUserSettings(userId)
    
    // Store settings in session context
    const sessionKey = `session:${sessionId}:settings`
    await getRedis().setex(
      sessionKey,
      3600, // 1 hour
      JSON.stringify({
        aiModel: settings.aiModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        enableWebSearch: settings.enableWebSearch,
        enableLocalDocs: settings.enableLocalDocs
      })
    )
    
    logger.debug(`Applied settings to session ${sessionId}`)
  }

  async getSessionSettings(sessionId: string): Promise<Partial<UserSettings> | null> {
    const sessionKey = `session:${sessionId}:settings`
    const settings = await getRedis().get(sessionKey)
    
    if (settings) {
      return JSON.parse(settings)
    }
    
    return null
  }
}

export const settingsService = new SettingsService()