-- Migration: Agentic Workflow System
-- Description: Schema for agent lifecycle, workflows, and orchestration

-- Agent States table
CREATE TABLE IF NOT EXISTS agent_states (
    agent_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    lifecycle_state VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    execution_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_states_lifecycle ON agent_states(lifecycle_state);
CREATE INDEX idx_agent_states_status ON agent_states(status);
CREATE INDEX idx_agent_states_type ON agent_states(type);

-- Agent Dependencies table
CREATE TABLE IF NOT EXISTS agent_dependencies (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    depends_on VARCHAR(255) NOT NULL,
    dependency_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_agent_dependency FOREIGN KEY (agent_id) REFERENCES agent_states(agent_id) ON DELETE CASCADE,
    CONSTRAINT fk_depends_on FOREIGN KEY (depends_on) REFERENCES agent_states(agent_id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_dependencies_agent ON agent_dependencies(agent_id);
CREATE INDEX idx_agent_dependencies_depends_on ON agent_dependencies(depends_on);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(100),
    definition JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    session_id VARCHAR(255),
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_session ON workflows(session_id);
CREATE INDEX idx_workflows_user ON workflows(user_id);

-- Workflow Steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL,
    phase VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    inputs JSONB DEFAULT '{}',
    outputs JSONB DEFAULT '{}',
    agents TEXT[], -- Array of agent IDs
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error TEXT,
    execution_order INTEGER,
    CONSTRAINT fk_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX idx_workflow_steps_phase ON workflow_steps(phase);

-- Agent Performance Metrics table
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(255),
    task_completion_rate DECIMAL(5,4),
    average_response_time DECIMAL(10,2),
    error_rate DECIMAL(5,4),
    quality_score DECIMAL(5,4),
    overall_score DECIMAL(5,4),
    samples_count INTEGER DEFAULT 0,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_agent_metrics FOREIGN KEY (agent_id) REFERENCES agent_states(agent_id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_metrics FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_performance_agent ON agent_performance_metrics(agent_id);
CREATE INDEX idx_agent_performance_workflow ON agent_performance_metrics(workflow_id);
CREATE INDEX idx_agent_performance_measured ON agent_performance_metrics(measured_at);

-- Agent Evolution History table
CREATE TABLE IF NOT EXISTS agent_evolution_history (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL,
    prompt TEXT,
    strategy VARCHAR(50),
    performance_before DECIMAL(5,4),
    performance_after DECIMAL(5,4),
    changes JSONB,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rolled_back BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_agent_evolution FOREIGN KEY (agent_id) REFERENCES agent_states(agent_id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_evolution_agent ON agent_evolution_history(agent_id);
CREATE INDEX idx_agent_evolution_version ON agent_evolution_history(version);

-- Collaboration Sessions table
CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id VARCHAR(255),
    objective TEXT,
    participants TEXT[], -- Array of agent IDs
    context JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    result JSONB,
    CONSTRAINT fk_collaboration_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_collaboration_workflow ON collaboration_sessions(workflow_id);
CREATE INDEX idx_collaboration_status ON collaboration_sessions(status);

-- Agent Messages table (for communication audit trail)
CREATE TABLE IF NOT EXISTS agent_messages (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255),
    priority INTEGER DEFAULT 1,
    payload JSONB,
    context JSONB,
    correlation_id VARCHAR(255),
    requires_response BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_messages_sender ON agent_messages(sender);
CREATE INDEX idx_agent_messages_recipient ON agent_messages(recipient);
CREATE INDEX idx_agent_messages_type ON agent_messages(type);
CREATE INDEX idx_agent_messages_timestamp ON agent_messages(timestamp);

-- Workflow Templates table (for reusable workflows)
CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    project_type VARCHAR(100),
    template JSONB NOT NULL,
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_templates_type ON workflow_templates(project_type);
CREATE INDEX idx_workflow_templates_active ON workflow_templates(is_active);

-- Update agents table to add workflow-related fields
ALTER TABLE agents ADD COLUMN IF NOT EXISTS workflow_id VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_pool_id VARCHAR(255);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) DEFAULT 'system';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS evolution_version INTEGER DEFAULT 1;

-- Update agent_executions table to add workflow context
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS workflow_id VARCHAR(255);
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS step_id VARCHAR(255);
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS collaboration_id VARCHAR(255);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agent_states_updated_at BEFORE UPDATE ON agent_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default workflow templates
INSERT INTO workflow_templates (name, description, project_type, template, tags) VALUES
(
    'Web Application',
    'Standard workflow for web application development',
    'web_application',
    '{
        "phases": ["brainstorming", "requirements", "architecture", "development", "testing", "deployment"],
        "agents": ["architect", "python_backend", "frontend_vue", "qa_engineer", "devops_engineer"],
        "estimated_time": "2-4 weeks"
    }'::jsonb,
    ARRAY['web', 'fullstack', 'standard']
),
(
    'API Service',
    'Workflow for API-only service development',
    'api_service',
    '{
        "phases": ["requirements", "architecture", "development", "testing", "deployment"],
        "agents": ["architect", "python_backend", "database_engineer", "qa_engineer"],
        "estimated_time": "1-2 weeks"
    }'::jsonb,
    ARRAY['api', 'backend', 'microservice']
),
(
    'Documentation Only',
    'Workflow for creating technical documentation',
    'documentation',
    '{
        "phases": ["requirements", "architecture", "documentation"],
        "agents": ["architect", "technical_writer"],
        "estimated_time": "3-5 days"
    }'::jsonb,
    ARRAY['docs', 'documentation', 'writing']
)
ON CONFLICT (name) DO NOTHING;