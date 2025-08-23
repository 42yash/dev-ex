import { config } from '../config/index.js'

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecial: boolean
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
  score: number
}

export class PasswordValidator {
  private policy: PasswordPolicy

  constructor(policy?: Partial<PasswordPolicy>) {
    this.policy = {
      minLength: policy?.minLength || parseInt(process.env.PASSWORD_MIN_LENGTH || '12'),
      requireUppercase: policy?.requireUppercase ?? (process.env.PASSWORD_REQUIRE_UPPERCASE === 'true'),
      requireLowercase: policy?.requireLowercase ?? (process.env.PASSWORD_REQUIRE_LOWERCASE === 'true'),
      requireNumbers: policy?.requireNumbers ?? (process.env.PASSWORD_REQUIRE_NUMBERS === 'true'),
      requireSpecial: policy?.requireSpecial ?? (process.env.PASSWORD_REQUIRE_SPECIAL === 'true')
    }
  }

  validate(password: string): PasswordValidationResult {
    const errors: string[] = []
    let score = 0

    // Check minimum length
    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`)
    } else {
      score += 20
      // Extra points for longer passwords
      if (password.length >= 16) score += 10
      if (password.length >= 20) score += 10
    }

    // Check uppercase requirement
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    } else if (/[A-Z]/.test(password)) {
      score += 15
    }

    // Check lowercase requirement
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    } else if (/[a-z]/.test(password)) {
      score += 15
    }

    // Check number requirement
    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    } else if (/\d/.test(password)) {
      score += 15
    }

    // Check special character requirement
    const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
    if (this.policy.requireSpecial && !specialChars.test(password)) {
      errors.push('Password must contain at least one special character')
    } else if (specialChars.test(password)) {
      score += 15
    }

    // Check for common patterns
    if (this.hasCommonPatterns(password)) {
      errors.push('Password contains common patterns or sequences')
      score -= 20
    }

    // Check for repeated characters
    if (this.hasRepeatedCharacters(password)) {
      errors.push('Password contains too many repeated characters')
      score -= 10
    }

    // Calculate strength
    let strength: 'weak' | 'medium' | 'strong' | 'very-strong'
    if (score < 40) strength = 'weak'
    else if (score < 60) strength = 'medium'
    else if (score < 80) strength = 'strong'
    else strength = 'very-strong'

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.max(0, Math.min(100, score))
    }
  }

  private hasCommonPatterns(password: string): boolean {
    const commonPatterns = [
      '123456', 'abcdef', 'password', 'qwerty', 'admin',
      '111111', '000000', 'abc123', 'password123',
      'letmein', 'welcome', 'monkey', 'dragon'
    ]
    
    const lowerPassword = password.toLowerCase()
    return commonPatterns.some(pattern => lowerPassword.includes(pattern))
  }

  private hasRepeatedCharacters(password: string): boolean {
    // Check for 3 or more repeated characters
    return /(.)\1{2,}/.test(password)
  }

  generateStrongPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    
    let charset = ''
    let password = ''
    
    // Ensure we meet all requirements
    if (this.policy.requireUppercase) {
      charset += uppercase
      password += uppercase[Math.floor(Math.random() * uppercase.length)]
    }
    if (this.policy.requireLowercase) {
      charset += lowercase
      password += lowercase[Math.floor(Math.random() * lowercase.length)]
    }
    if (this.policy.requireNumbers) {
      charset += numbers
      password += numbers[Math.floor(Math.random() * numbers.length)]
    }
    if (this.policy.requireSpecial) {
      charset += special
      password += special[Math.floor(Math.random() * special.length)]
    }
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)]
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  checkPasswordHistory(password: string, previousHashes: string[]): boolean {
    // This would need to be implemented with bcrypt comparison
    // For now, returning true (not in history)
    return true
  }
}

// Export singleton instance
export const passwordValidator = new PasswordValidator()