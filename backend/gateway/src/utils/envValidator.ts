import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

// Environment variable schema
const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Server
  PORT: z.string().regex(/^\d+$/).transform(Number).default('8080'),
  
  // Security - JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  
  // Security - Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('3600'),
  
  // Database
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  
  // Redis
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),
  
  // AI Service
  AI_SERVICE_URL: z.string().default('ai-services:50051'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
  
  // Password Policy
  PASSWORD_MIN_LENGTH: z.string().regex(/^\d+$/).transform(Number).default('12'),
  PASSWORD_REQUIRE_UPPERCASE: z.string().transform(val => val === 'true').default('true'),
  PASSWORD_REQUIRE_LOWERCASE: z.string().transform(val => val === 'true').default('true'),
  PASSWORD_REQUIRE_NUMBERS: z.string().transform(val => val === 'true').default('true'),
  PASSWORD_REQUIRE_SPECIAL: z.string().transform(val => val === 'true').default('true'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

// Custom validators
const validateSecrets = (env: any) => {
  const errors: string[] = []
  
  // Check for default values
  const secretFields = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET']
  for (const field of secretFields) {
    if (env[field]?.includes('CHANGE-THIS') || env[field]?.includes('use-openssl')) {
      errors.push(`${field} contains default value. Please generate a secure secret.`)
    }
  }
  
  // Check JWT secrets are different
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different')
  }
  
  // Production-specific checks
  if (env.NODE_ENV === 'production') {
    if (env.LOG_LEVEL === 'debug') {
      errors.push('LOG_LEVEL should not be "debug" in production')
    }
    
    if (env.CORS_ORIGIN === '*' || env.CORS_ORIGIN?.includes('localhost')) {
      errors.push('CORS_ORIGIN is not secure for production')
    }
  }
  
  return errors
}

export type Env = z.infer<typeof envSchema>

export const validateEnv = (): Env => {
  try {
    // Parse environment variables
    const parsed = envSchema.parse(process.env)
    
    // Additional custom validation
    const customErrors = validateSecrets(parsed)
    if (customErrors.length > 0) {
      console.error('❌ Environment validation failed:')
      customErrors.forEach(error => console.error(`  - ${error}`))
      console.error('\nTo generate secure secrets, use:')
      console.error('  openssl rand -base64 32')
      process.exit(1)
    }
    
    // Log successful validation
    console.log('✅ Environment validation passed')
    
    // Mask sensitive values for logging
    const masked = { ...parsed }
    const sensitiveFields = [
      'JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET',
      'DATABASE_URL', 'REDIS_URL'
    ]
    
    for (const field of sensitiveFields) {
      if (masked[field as keyof typeof masked]) {
        (masked as any)[field] = '***MASKED***'
      }
    }
    
    if (parsed.NODE_ENV === 'development') {
      console.log('Environment configuration:', masked)
    }
    
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:')
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      console.error('\nPlease check your .env file and ensure all required variables are set.')
    } else {
      console.error('❌ Unexpected error during environment validation:', error)
    }
    process.exit(1)
  }
}

// Export validated environment
export const env = validateEnv()