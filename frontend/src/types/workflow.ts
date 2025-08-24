export interface WorkflowStep {
  id: string
  phase: WorkflowPhase
  name: string
  description: string
  agents: string[]
  status: StepStatus
  inputs?: Record<string, any>
  outputs?: Record<string, any>
  startedAt?: Date
  completedAt?: Date
  error?: string
}

export enum WorkflowPhase {
  BRAINSTORMING = 'brainstorming',
  REQUIREMENTS = 'requirements',
  ARCHITECTURE = 'architecture',
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring'
}

export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface WorkflowStatus {
  workflowId: string
  name: string
  progress: string
  percentage: number
  currentPhase: string | null
  agents: Record<string, AgentStatus>
  steps: WorkflowStep[]
}

export interface AgentStatus {
  name: string
  state: string
  status: string
}

export interface WorkflowTemplate {
  name: string
  description: string
  projectType: string
  estimatedTime: string
  phases: WorkflowPhase[]
  agents: string[]
}