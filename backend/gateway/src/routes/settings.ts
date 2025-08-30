import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { settingsService } from '../services/settings.js'
import { logger } from '../utils/logger.js'

// Settings schema
const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh']).optional(),
  aiModel: z.enum(['gemini', 'gpt4', 'claude']).optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(100).max(4096).optional(),
  enableLocalDocs: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
  enableCustomSources: z.boolean().optional(),
  customSettings: z.record(z.any()).optional()
})

export default async function settingsRoutes(fastify: FastifyInstance) {
  // Get user settings
  fastify.get(
    '/settings',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id
        
        const settings = await settingsService.getUserSettings(userId)
        
        return reply.send({
          success: true,
          settings
        })
      } catch (error) {
        logger.error('Error fetching settings:', error)
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch settings'
        })
      }
    }
  )

  // Update user settings
  fastify.put(
    '/settings',
    { 
      preHandler: authMiddleware
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id
        const updates = settingsSchema.parse(request.body)
        
        const updatedSettings = await settingsService.updateUserSettings(
          userId,
          updates
        )
        
        logger.info(`Settings updated for user ${userId}`)
        
        return reply.send({
          success: true,
          settings: updatedSettings,
          message: 'Settings updated successfully'
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.errors
          })
        }
        logger.error('Error updating settings:', error)
        return reply.status(500).send({
          success: false,
          error: 'Failed to update settings'
        })
      }
    }
  )

  // Reset settings to default
  fastify.post(
    '/settings/reset',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id
        
        const defaultSettings = await settingsService.resetToDefaults(userId)
        
        logger.info(`Settings reset to defaults for user ${userId}`)
        
        return reply.send({
          success: true,
          settings: defaultSettings,
          message: 'Settings reset to defaults'
        })
      } catch (error) {
        logger.error('Error resetting settings:', error)
        return reply.status(500).send({
          success: false,
          error: 'Failed to reset settings'
        })
      }
    }
  )

  // Get available AI models
  fastify.get(
    '/settings/models',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const models = await settingsService.getAvailableModels()
        
        return reply.send({
          success: true,
          models
        })
      } catch (error) {
        logger.error('Error fetching models:', error)
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch available models'
        })
      }
    }
  )

  // Get available themes
  fastify.get(
    '/settings/themes',
    async (request, reply) => {
      return reply.send({
        success: true,
        themes: [
          { value: 'light', label: 'Light', description: 'Light theme for daytime use' },
          { value: 'dark', label: 'Dark', description: 'Dark theme for reduced eye strain' },
          { value: 'auto', label: 'Auto', description: 'Automatically switch based on system preference' }
        ]
      })
    }
  )

  // Get supported languages
  fastify.get(
    '/settings/languages',
    async (request, reply) => {
      return reply.send({
        success: true,
        languages: [
          { value: 'en', label: 'English', nativeName: 'English' },
          { value: 'es', label: 'Spanish', nativeName: 'Español' },
          { value: 'fr', label: 'French', nativeName: 'Français' },
          { value: 'de', label: 'German', nativeName: 'Deutsch' },
          { value: 'ja', label: 'Japanese', nativeName: '日本語' },
          { value: 'zh', label: 'Chinese', nativeName: '中文' }
        ]
      })
    }
  )
}