# Security Setup Guide for Dev-Ex Platform

## Overview
This guide covers the security implementations added to the Dev-Ex platform, including setup instructions, configuration, and usage.

## Table of Contents
1. [Initial Setup](#initial-setup)
2. [Security Features](#security-features)
3. [Configuration](#configuration)
4. [API Documentation](#api-documentation)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)

## Initial Setup

### 1. Install Dependencies
```bash
cd backend/gateway
npm install
```

### 2. Run Database Migrations
```bash
# Check migration status
npm run migrate:status

# Run all pending migrations
npm run migrate:up

# Rollback if needed
npm run migrate:down
```

### 3. Configure Environment Variables
Update your `.env` file with secure values:

```env
# JWT Secrets (minimum 32 characters)
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars
SESSION_SECRET=your-super-secure-session-secret-min-32-chars

# Token Expiry
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

### 4. Start the Server
```bash
npm run dev
```

## Security Features

### 1. Input Validation
- **Location**: `src/middleware/validation.ts`
- **Features**:
  - Zod schema validation
  - XSS protection with DOMPurify
  - SQL injection prevention
  - Request size limits

### 2. Rate Limiting
- **Location**: `src/middleware/rateLimiter.ts`
- **Endpoints**:
  - Auth: 5 attempts/15 min
  - Password reset: 3 attempts/hour
  - Chat: 30 messages/5 min
  - API: 1000 requests/15 min

### 3. JWT Token Management
- **Location**: `src/services/tokenService.ts`
- **Features**:
  - Access/refresh token separation
  - Automatic token rotation
  - Token revocation
  - Replay attack prevention

### 4. API Key System
- **Location**: `src/services/apiKeyService.ts`
- **Features**:
  - Secure key generation
  - Permission-based access
  - Key rotation
  - Usage tracking

### 5. Audit Logging
- **Location**: `src/services/auditLogger.ts`
- **Features**:
  - Comprehensive event tracking
  - Security pattern detection
  - Alert generation
  - Batch processing

### 6. Security Headers
- **Location**: `src/middleware/security.ts`
- **Headers**:
  - CSP with nonce
  - X-Frame-Options
  - X-XSS-Protection
  - HSTS (production)

### 7. Database Security
- **Location**: `src/services/secureDatabase.ts`
- **Features**:
  - Parameterized queries
  - Query validation
  - Table/column whitelisting
  - Transaction support

## API Documentation

### Authentication Endpoints

#### Create API Key
```bash
POST /api/v1/keys
Authorization: Bearer <jwt-token>

{
  "name": "Production API Key",
  "permissions": ["read", "write"],
  "expiresInDays": 90
}
```

#### List API Keys
```bash
GET /api/v1/keys
Authorization: Bearer <jwt-token>
```

#### Rotate API Key
```bash
POST /api/v1/keys/rotate
Authorization: Bearer <jwt-token>

{
  "keyId": "uuid"
}
```

#### Revoke API Key
```bash
DELETE /api/v1/keys/:keyId
Authorization: Bearer <jwt-token>
```

### Security Dashboard (Admin Only)

#### Get Security Dashboard
```bash
GET /api/v1/security/dashboard
Authorization: Bearer <admin-jwt-token>
```

#### Query Audit Logs
```bash
GET /api/v1/security/audit-logs?userId=xxx&eventType=auth_failure&limit=100
Authorization: Bearer <admin-jwt-token>
```

#### Get Security Alerts
```bash
GET /api/v1/security/alerts?severity=high&resolved=false
Authorization: Bearer <admin-jwt-token>
```

#### Block/Unblock IP
```bash
# Block IP
POST /api/v1/security/block-ip
Authorization: Bearer <admin-jwt-token>

{
  "ipAddress": "192.168.1.1",
  "reason": "Suspicious activity",
  "duration": 24
}

# Unblock IP
DELETE /api/v1/security/blocked-ips/:ip
Authorization: Bearer <admin-jwt-token>
```

#### Lock/Unlock User Account
```bash
POST /api/v1/security/users/:userId/lock
Authorization: Bearer <admin-jwt-token>

{
  "lock": true,
  "reason": "Security violation",
  "duration": 48
}
```

## Monitoring & Maintenance

### Automated Cleanup Jobs
The following cron jobs run automatically:

| Job Name | Schedule | Description |
|----------|----------|-------------|
| cleanup-expired-tokens | Every 6 hours | Remove expired refresh tokens |
| cleanup-api-keys | Daily at 2 AM | Remove expired/revoked API keys |
| cleanup-old-audit-logs | Weekly | Archive logs older than 1 year |
| cleanup-rate-limits | Every 15 min | Clear expired rate limit records |
| unlock-expired-accounts | Every 5 min | Auto-unlock expired locks |
| security-report | Weekly Monday | Generate security report |

### Manual Job Execution
```bash
# Check cron job status
GET /api/v1/security/cron-status

# Run job manually
POST /api/v1/security/cron-run/:jobName
```

### Security Monitoring Queries

#### Check Failed Login Attempts
```sql
SELECT email, COUNT(*) as attempts, MAX(created_at) as last_attempt
FROM login_attempts
WHERE success = false 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY email
HAVING COUNT(*) > 3;
```

#### Active Security Alerts
```sql
SELECT type, severity, COUNT(*) as count
FROM security_alerts
WHERE resolved = false
GROUP BY type, severity
ORDER BY severity DESC;
```

#### Suspicious Activity Pattern
```sql
SELECT user_id, ip_address, COUNT(*) as event_count
FROM audit_logs
WHERE result = 'failure'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id, ip_address
HAVING COUNT(*) > 10;
```

## Testing Security

### 1. Test Rate Limiting
```bash
# Test auth rate limiting (should block after 5 attempts)
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

### 2. Test API Key Authentication
```bash
# Create API key (requires JWT)
TOKEN="your-jwt-token"
curl -X POST http://localhost:8080/api/v1/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Key","permissions":["read"]}'

# Use API key
API_KEY="devex_xxxxx"
curl -X GET http://localhost:8080/api/v1/test \
  -H "X-API-Key: $API_KEY"
```

### 3. Test Input Validation
```bash
# Test XSS prevention
curl -X POST http://localhost:8080/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"<script>alert(1)</script>"}'

# Test SQL injection prevention
curl -X GET "http://localhost:8080/api/v1/users?id=1' OR '1'='1"
```

### 4. Security Audit
```bash
# Run security audit
npm run security:audit

# Check for vulnerabilities
npm audit

# Update dependencies
npm update
```

## Troubleshooting

### Common Issues

#### 1. Migration Fails
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check migration status
npm run migrate:status

# Reset migrations (development only)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS migrations"
npm run migrate:up
```

#### 2. Rate Limiting Too Strict
Adjust in `.env`:
```env
RATE_LIMIT_WINDOW_MS=900000  # Increase window
RATE_LIMIT_MAX_REQUESTS=200  # Increase limit
```

#### 3. JWT Token Issues
```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
```

#### 4. Cron Jobs Not Running
```bash
# Check cron status
curl http://localhost:8080/api/v1/security/cron-status \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Run manually
curl -X POST http://localhost:8080/api/v1/security/cron-run/cleanup-expired-tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique secrets
   - Rotate secrets regularly

2. **Database**
   - Use read-only database users where possible
   - Enable SSL for database connections
   - Regular backups with encryption

3. **API Keys**
   - Rotate keys every 90 days
   - Use minimal required permissions
   - Monitor usage patterns

4. **Monitoring**
   - Review security alerts daily
   - Check audit logs for anomalies
   - Set up alerting for critical events

5. **Updates**
   - Keep dependencies updated
   - Apply security patches promptly
   - Regular security audits

## Support

For security issues or questions:
- Review logs: `backend/gateway/logs/`
- Check documentation: `docs/security/`
- Security email: security@dev-ex.platform

## Next Steps

1. Configure production environment variables
2. Set up SSL/TLS certificates
3. Configure firewall rules
4. Set up monitoring dashboards
5. Implement backup strategy
6. Schedule penetration testing

---

Last Updated: 2025-08-28