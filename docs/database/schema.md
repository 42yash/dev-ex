# Database Schema Documentation

## Overview

The Dev-Ex platform uses PostgreSQL as its primary database with the pgvector extension for semantic search capabilities. The schema is designed to support user management, session tracking, workflow orchestration, agent management, and comprehensive security features.

## Database Structure

### Core Tables

#### users
Primary user account information.
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    backup_codes TEXT[],
    last_password_change TIMESTAMP DEFAULT NOW(),
    account_locked BOOLEAN DEFAULT false,
    lock_reason TEXT,
    locked_until TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

#### sessions
User session management.
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

#### messages
Chat messages and AI responses.
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL, -- 'user' or 'ai'
    content TEXT NOT NULL,
    tokens_used INTEGER,
    processing_time FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

### Widget System Tables

#### widgets
Dynamic UI components for interactive interfaces.
```sql
CREATE TABLE widgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Document Management Tables

#### documents
Source documents for the Q&A system.
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_name VARCHAR(100) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connector_name, source_id)
);
```

#### document_chunks
Document segments with vector embeddings for semantic search.
```sql
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, chunk_index)
);
```

### Agent Management Tables

#### agents
Agent definitions and configurations.
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    system_prompt TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### agent_executions
Agent execution history and results.
```sql
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    input JSONB NOT NULL,
    output JSONB,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

### Workflow Tables

#### workflows
Workflow definitions and state (from migration 004).
```sql
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    n8n_workflow_id VARCHAR(100),
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Security Tables (from migration 002)

#### refresh_tokens
JWT refresh token management.
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP
);
```

#### api_keys
API key management with permissions.
```sql
CREATE TABLE api_keys (
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
    metadata JSONB DEFAULT '{}'::JSONB
);
```

#### audit_logs
Comprehensive audit trail for security events.
```sql
CREATE TABLE audit_logs (
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
```

#### security_alerts
Security incident tracking.
```sql
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
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
```

#### rate_limit_tracking
Persistent rate limiting data.
```sql
CREATE TABLE rate_limit_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    window_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(identifier, endpoint, window_start)
);
```

#### blocked_ips
IP blocking for security enforcement.
```sql
CREATE TABLE blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_until TIMESTAMP,
    blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);
```

#### session_security
Enhanced session tracking for security.
```sql
CREATE TABLE session_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    fingerprint VARCHAR(255),
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### password_history
Password reuse prevention.
```sql
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### login_attempts
Failed login tracking for security monitoring.
```sql
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Indexes

### Performance Indexes
```sql
-- User lookups
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
CREATE INDEX idx_users_locked ON users(account_locked) WHERE account_locked = true;

-- Session management
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Widget system
CREATE INDEX idx_widgets_message_id ON widgets(message_id);

-- Document search
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_documents_connector ON documents(connector_name);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);

-- Agent tracking
CREATE INDEX idx_agent_executions_session ON agent_executions(session_id);
CREATE INDEX idx_agent_executions_agent ON agent_executions(agent_id);
```

### Vector Search Index
```sql
-- Optimized vector similarity search
CREATE INDEX idx_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Full-Text Search Indexes
```sql
CREATE INDEX idx_documents_title_fts ON documents 
  USING GIN(to_tsvector('english', title));
CREATE INDEX idx_documents_content_fts ON documents 
  USING GIN(to_tsvector('english', content));
CREATE INDEX idx_chunks_content_fts ON document_chunks 
  USING GIN(to_tsvector('english', content));
```

### Security Indexes
```sql
-- Token management
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_expiry ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_revoked ON refresh_tokens(revoked) WHERE revoked = false;

-- API keys
CREATE UNIQUE INDEX idx_api_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_user_keys ON api_keys(user_id) WHERE revoked = false;
CREATE INDEX idx_api_key_expiry ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Audit logs
CREATE INDEX idx_audit_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_ip ON audit_logs(ip_address);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);

-- Security monitoring
CREATE INDEX idx_alert_severity ON security_alerts(severity) WHERE resolved = false;
CREATE INDEX idx_alert_unresolved ON security_alerts(resolved, severity) WHERE resolved = false;
CREATE INDEX idx_blocked_ip ON blocked_ips(ip_address);
CREATE INDEX idx_login_attempts_failed ON login_attempts(email, created_at DESC) WHERE success = false;
```

## Functions and Triggers

### Update Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
```

Applied to multiple tables:
```sql
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ... (additional triggers for other tables)
```

### Semantic Search Function
```sql
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(1536),
    connector_filter text DEFAULT NULL,
    metadata_filter jsonb DEFAULT NULL,
    result_limit int DEFAULT 10
)
RETURNS TABLE (
    chunk_id uuid,
    content text,
    similarity float,
    metadata jsonb,
    document_title text
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_chunks AS (
        SELECT c.*, d.title as doc_title
        FROM document_chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE 
            (connector_filter IS NULL OR d.connector_name = connector_filter)
            AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    )
    SELECT 
        fc.id as chunk_id,
        fc.content,
        1 - (fc.embedding <=> query_embedding) as similarity,
        fc.metadata,
        fc.doc_title as document_title
    FROM filtered_chunks fc
    ORDER BY fc.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
```

### Cleanup Function
```sql
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
    
    -- Additional cleanup operations...
END;
$$ LANGUAGE plpgsql;
```

## Migration Strategy

### Current Migrations
1. **001_initial**: Base schema (in init.sql)
2. **002_security_tables**: Security enhancements
3. **004_agentic_workflow**: Workflow support
4. **005_agentic_workflow_fixed**: Workflow corrections

### Migration Management
```bash
# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

## Data Retention Policies

| Table | Retention Period | Cleanup Method |
|-------|-----------------|----------------|
| audit_logs | 1 year | Automated cleanup function |
| refresh_tokens | 30 days after revocation | Automated cleanup function |
| api_keys | 90 days after revocation | Automated cleanup function |
| login_attempts | 30 days | Automated cleanup function |
| password_history | Last 10 per user | Automated cleanup function |
| rate_limit_tracking | Until window expires | Automated cleanup function |
| security_alerts | 90 days after resolution | Automated cleanup function |

## Performance Considerations

### Connection Pooling
- Minimum connections: 10
- Maximum connections: 100
- Connection timeout: 30 seconds
- Idle timeout: 10 minutes

### Query Optimization
- Use indexes for frequent queries
- Implement pagination for large result sets
- Use JSONB operators for metadata queries
- Leverage vector indexes for similarity search

### Partitioning Strategy
For high-volume tables, consider partitioning:
```sql
-- Example: Partition audit_logs by month
CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Security Best Practices

1. **Access Control**
   - Use role-based permissions
   - Implement row-level security where appropriate
   - Regular permission audits

2. **Data Encryption**
   - Enable SSL/TLS for connections
   - Encrypt sensitive columns at rest
   - Use pgcrypto for additional encryption needs

3. **Monitoring**
   - Track slow queries
   - Monitor connection pool usage
   - Alert on unusual access patterns

4. **Backup Strategy**
   - Daily automated backups
   - Point-in-time recovery capability
   - Regular backup restoration tests

## Related Documentation

- [Security Documentation](../security/SECURITY.md)
- [Workflow System](../implementation/workflow-system.md)
- [Architecture Overview](../architecture/overview.md)
- [API Reference](../api/grpc-reference.md)