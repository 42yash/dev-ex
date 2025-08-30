-- Security Tables Migration
-- Version: 002
-- Description: Add security-related tables for API keys, refresh tokens, audit logs, and security alerts

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expiry ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_revoked ON refresh_tokens(revoked) WHERE revoked = false;

-- API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT ARRAY['read']::TEXT[],
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB,
    CONSTRAINT fk_apikey_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_api_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_user_keys ON api_keys(user_id) WHERE revoked = false;
CREATE INDEX idx_api_key_expiry ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_key_name ON api_keys(user_id, name);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    resource VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'error')),
    metadata JSONB DEFAULT '{}'::JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    request_id UUID,
    session_id UUID
);

-- Indexes for audit logs
CREATE INDEX idx_audit_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_ip ON audit_logs(ip_address);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_result ON audit_logs(result);
CREATE INDEX idx_audit_resource ON audit_logs(resource) WHERE resource IS NOT NULL;

-- Partitioning for audit_logs by month (optional for large datasets)
-- CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Security Alerts Table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('brute_force', 'suspicious_activity', 'data_breach', 'unauthorized_access', 'api_abuse')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    metadata JSONB DEFAULT '{}'::JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_severity ON security_alerts(severity) WHERE resolved = false;
CREATE INDEX idx_alert_type ON security_alerts(type);
CREATE INDEX idx_alert_created ON security_alerts(created_at DESC);
CREATE INDEX idx_alert_user ON security_alerts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_alert_unresolved ON security_alerts(resolved, severity) WHERE resolved = false;

-- Rate Limit Tracking Table (for persistent rate limiting)
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- Could be user_id, ip, api_key, etc.
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    window_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limit_identifier ON rate_limit_tracking(identifier);
CREATE INDEX idx_rate_limit_window ON rate_limit_tracking(window_end) WHERE window_end > NOW();

-- Blocked IPs Table
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_until TIMESTAMP,
    blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_blocked_ip ON blocked_ips(ip_address);
CREATE INDEX idx_blocked_until ON blocked_ips(blocked_until) WHERE blocked_until IS NOT NULL;

-- Session Security Table (for tracking active sessions)
CREATE TABLE IF NOT EXISTS session_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    fingerprint VARCHAR(255), -- Browser fingerprint for additional security
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_security_session ON session_security(session_id);
CREATE INDEX idx_session_security_user ON session_security(user_id);
CREATE INDEX idx_session_security_active ON session_security(is_active, expires_at) WHERE is_active = true;

-- Password History Table (prevent password reuse)
CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_password_history_user ON password_history(user_id);
CREATE INDEX idx_password_history_created ON password_history(created_at DESC);

-- Login Attempts Table (for tracking failed logins)
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created ON login_attempts(created_at DESC);
CREATE INDEX idx_login_attempts_failed ON login_attempts(email, created_at DESC) WHERE success = false;

-- Add security columns to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP;

-- Create cleanup function for expired data
CREATE OR REPLACE FUNCTION cleanup_expired_security_data() RETURNS void AS $$
BEGIN
    -- Clean expired refresh tokens
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() OR (revoked = true AND revoked_at < NOW() - INTERVAL '30 days');
    
    -- Clean expired API keys
    DELETE FROM api_keys 
    WHERE (expires_at IS NOT NULL AND expires_at < NOW()) 
       OR (revoked = true AND revoked_at < NOW() - INTERVAL '90 days');
    
    -- Clean old audit logs (keep 1 year)
    DELETE FROM audit_logs 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Clean resolved security alerts older than 90 days
    DELETE FROM security_alerts 
    WHERE resolved = true AND resolved_at < NOW() - INTERVAL '90 days';
    
    -- Clean expired rate limit tracking
    DELETE FROM rate_limit_tracking 
    WHERE window_end < NOW();
    
    -- Clean expired IP blocks
    DELETE FROM blocked_ips 
    WHERE blocked_until IS NOT NULL AND blocked_until < NOW();
    
    -- Clean old login attempts (keep 30 days)
    DELETE FROM login_attempts 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Clean old password history (keep last 10 per user)
    DELETE FROM password_history 
    WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
            FROM password_history
        ) t WHERE rn > 10
    );
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(account_locked) WHERE account_locked = true;

-- Grants (adjust based on your database users)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO devex_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO devex_app;