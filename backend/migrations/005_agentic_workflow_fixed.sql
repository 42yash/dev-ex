-- Migration: Agentic Workflow System (Fixed)
-- Description: Schema for agent lifecycle, workflows, and orchestration

-- Rename existing workflows table to n8n_workflows to avoid conflict
ALTER TABLE IF EXISTS workflows RENAME TO n8n_workflows;

-- Create new agentic workflows table
CREATE TABLE IF NOT EXISTS agentic_workflows (
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

CREATE INDEX IF NOT EXISTS idx_agentic_workflows_status ON agentic_workflows(status);
CREATE INDEX IF NOT EXISTS idx_agentic_workflows_session ON agentic_workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_agentic_workflows_user ON agentic_workflows(user_id);

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
    CONSTRAINT fk_workflow FOREIGN KEY (workflow_id) REFERENCES agentic_workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_phase ON workflow_steps(phase);

-- Agent Performance Metrics table (if not exists)
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
    CONSTRAINT fk_workflow_metrics FOREIGN KEY (workflow_id) REFERENCES agentic_workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent ON agent_performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_workflow ON agent_performance_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_measured ON agent_performance_metrics(measured_at);

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
    CONSTRAINT fk_collaboration_workflow FOREIGN KEY (workflow_id) REFERENCES agentic_workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collaboration_workflow ON collaboration_sessions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_status ON collaboration_sessions(status);

-- Create trigger for agentic_workflows updated_at
DROP TRIGGER IF EXISTS update_agentic_workflows_updated_at ON agentic_workflows;
CREATE TRIGGER update_agentic_workflows_updated_at BEFORE UPDATE ON agentic_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();