import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const configSchema = z.object({
  app: z.object({
    port: z.number().min(1).max(65535),
    env: z.enum(['development', 'production', 'test'])
  }),
  database: z.object({
    url: z.string().url()
  }),
  redis: z.object({
    url: z.string().url()
  }),
  jwt: z.object({
    secret: z.string().min(32),
    refreshSecret: z.string().min(32),
    expiry: z.string(),
    refreshExpiry: z.string()
  }),
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string()), z.boolean()])
  }),
  rateLimit: z.object({
    max: z.number(),
    windowMs: z.number()
  }),
  grpc: z.object({
    aiServiceUrl: z.string()
  })
})

const rawConfig = {
  app: {
    port: parseInt(process.env.PORT || '8080'),
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://devex:devex@postgres:5432/devex'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiry: process.env.JWT_EXPIRY || '1h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',') : 
      ['http://localhost:3000']
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
  },
  grpc: {
    aiServiceUrl: process.env.AI_SERVICE_URL || 'ai-services:50051'
  }
}

export const config = configSchema.parse(rawConfig)

export type Config = z.infer<typeof configSchema>