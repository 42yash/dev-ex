<template>
  <div class="workflow-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <h2 class="text-2xl font-bold">Workflow Dashboard</h2>
      <button
        v-if="!currentWorkflow"
        @click="showCreateDialog = true"
        class="btn-primary"
      >
        <PlusIcon class="w-5 h-5 mr-2" />
        Create Workflow
      </button>
    </div>

    <!-- Active Workflow -->
    <div v-if="currentWorkflow" class="active-workflow">
      <div class="workflow-card">
        <div class="workflow-header">
          <h3 class="text-xl font-semibold">{{ currentWorkflow.name }}</h3>
          <span class="workflow-status" :class="`status-${currentWorkflow.status}`">
            {{ currentWorkflow.status }}
          </span>
        </div>
        
        <p class="workflow-description">{{ currentWorkflow.description }}</p>
        
        <!-- Progress Bar -->
        <div class="progress-container">
          <div class="progress-bar">
            <div 
              class="progress-fill"
              :style="{ width: `${workflowProgress}%` }"
            />
          </div>
          <span class="progress-text">{{ completedSteps }}/{{ totalSteps }} steps</span>
        </div>
        
        <!-- Workflow Steps -->
        <div class="workflow-steps">
          <div 
            v-for="step in currentWorkflow.steps" 
            :key="step.id"
            class="workflow-step"
            :class="`step-${step.status}`"
          >
            <div class="step-indicator">
              <CheckCircleIcon v-if="step.status === 'completed'" class="w-6 h-6 text-green-500" />
              <PlayCircleIcon v-else-if="step.status === 'in_progress'" class="w-6 h-6 text-blue-500 animate-pulse" />
              <ClockIcon v-else class="w-6 h-6 text-gray-400" />
            </div>
            
            <div class="step-content">
              <h4 class="step-name">{{ step.name }}</h4>
              <p class="step-description">{{ step.description }}</p>
              <div class="step-agents">
                <span v-for="agent in step.agents" :key="agent" class="agent-badge">
                  {{ agent }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Workflow Controls -->
        <div class="workflow-controls">
          <button 
            v-if="currentWorkflow.status === 'created'"
            @click="executeWorkflow"
            class="btn-primary"
            :disabled="isExecuting"
          >
            <PlayIcon class="w-5 h-5 mr-2" />
            Execute
          </button>
          
          <button 
            v-if="currentWorkflow.status === 'in_progress'"
            @click="pauseWorkflow"
            class="btn-secondary"
          >
            <PauseIcon class="w-5 h-5 mr-2" />
            Pause
          </button>
          
          <button 
            v-if="currentWorkflow.status === 'paused'"
            @click="resumeWorkflow"
            class="btn-primary"
          >
            <PlayIcon class="w-5 h-5 mr-2" />
            Resume
          </button>
          
          <button 
            v-if="['in_progress', 'paused'].includes(currentWorkflow.status)"
            @click="cancelWorkflow"
            class="btn-danger"
          >
            <XMarkIcon class="w-5 h-5 mr-2" />
            Cancel
          </button>
        </div>
      </div>
      
      <!-- Workflow Updates -->
      <div v-if="workflowUpdates.length > 0" class="workflow-updates">
        <h3 class="text-lg font-semibold mb-3">Activity Log</h3>
        <div class="updates-list">
          <div v-for="update in recentUpdates" :key="update.updateId" class="update-item">
            <span class="update-time">{{ formatTime(update.timestamp) }}</span>
            <span class="update-message">{{ update.message }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- No Active Workflow -->
    <div v-else class="no-workflow">
      <div class="empty-state">
        <CubeTransparentIcon class="w-16 h-16 text-gray-400 mb-4" />
        <h3 class="text-xl font-semibold mb-2">No Active Workflow</h3>
        <p class="text-gray-600 mb-6">Create a workflow to transform your ideas into reality</p>
        
        <!-- Workflow Templates -->
        <div class="templates-grid">
          <div 
            v-for="template in workflowTemplates" 
            :key="template.name"
            class="template-card"
            @click="createFromTemplate(template)"
          >
            <h4 class="template-name">{{ template.name }}</h4>
            <p class="template-description">{{ template.description }}</p>
            <span class="template-time">{{ template.estimatedTime }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Create Workflow Dialog -->
    <Teleport to="body">
      <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
        <div class="dialog-content">
          <h3 class="dialog-title">Create New Workflow</h3>
          
          <div class="form-group">
            <label for="workflow-input">What do you want to build?</label>
            <textarea
              id="workflow-input"
              v-model="workflowInput"
              placeholder="Describe your project idea..."
              rows="4"
              class="form-textarea"
            />
          </div>
          
          <div class="dialog-actions">
            <button @click="showCreateDialog = false" class="btn-secondary">
              Cancel
            </button>
            <button @click="createWorkflow" class="btn-primary" :disabled="!workflowInput.trim()">
              Create Workflow
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  PlusIcon, 
  PlayIcon, 
  PauseIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  PlayCircleIcon, 
  ClockIcon,
  CubeTransparentIcon 
} from '@heroicons/vue/24/outline'
import { useWorkflow } from '@/composables/useWorkflow'
import { useSessionStore } from '@/stores/session'
import { useAuthStore } from '@/stores/auth'
import type { WorkflowTemplate } from '@/types/workflow'

const sessionStore = useSessionStore()
const authStore = useAuthStore()
const { 
  activeWorkflows,
  workflowUpdates,
  isCreating,
  isExecuting,
  createWorkflow: createWorkflowFn,
  executeWorkflow: executeWorkflowFn,
  pauseWorkflow: pauseWorkflowFn,
  resumeWorkflow: resumeWorkflowFn,
  cancelWorkflow: cancelWorkflowFn,
  streamWorkflowUpdates
} = useWorkflow()

// State
const showCreateDialog = ref(false)
const workflowInput = ref('')
const currentWorkflow = computed(() => activeWorkflows.value[0] || null)
const unsubscribe = ref<(() => void) | null>(null)

// Workflow templates
const workflowTemplates: WorkflowTemplate[] = [
  {
    name: 'Web Application',
    description: 'Full-stack web app with backend and frontend',
    projectType: 'web_application',
    estimatedTime: '2-4 weeks',
    phases: ['brainstorming', 'requirements', 'architecture', 'development', 'testing', 'deployment'],
    agents: ['architect', 'python_backend', 'frontend_vue', 'qa_engineer', 'devops_engineer']
  },
  {
    name: 'API Service',
    description: 'RESTful API with database integration',
    projectType: 'api_service',
    estimatedTime: '1-2 weeks',
    phases: ['requirements', 'architecture', 'development', 'testing', 'deployment'],
    agents: ['architect', 'python_backend', 'database_engineer', 'qa_engineer']
  },
  {
    name: 'Documentation',
    description: 'Technical documentation and guides',
    projectType: 'documentation',
    estimatedTime: '3-5 days',
    phases: ['requirements', 'architecture', 'documentation'],
    agents: ['architect', 'technical_writer']
  }
]

// Computed
const workflowProgress = computed(() => {
  if (!currentWorkflow.value) return 0
  const completed = currentWorkflow.value.steps.filter(s => s.status === 'completed').length
  return (completed / currentWorkflow.value.steps.length) * 100
})

const completedSteps = computed(() => {
  if (!currentWorkflow.value) return 0
  return currentWorkflow.value.steps.filter(s => s.status === 'completed').length
})

const totalSteps = computed(() => {
  return currentWorkflow.value?.steps.length || 0
})

const recentUpdates = computed(() => {
  return workflowUpdates.value.slice(-10).reverse()
})

// Methods
async function createWorkflow() {
  if (!workflowInput.value.trim()) return
  
  await createWorkflowFn({
    userInput: workflowInput.value,
    sessionId: sessionStore.currentSessionId || '',
    userId: authStore.user?.id || '',
    options: {}
  })
  
  showCreateDialog.value = false
  workflowInput.value = ''
  
  // Start streaming updates if workflow created
  if (currentWorkflow.value) {
    startStreamingUpdates()
  }
}

async function createFromTemplate(template: WorkflowTemplate) {
  workflowInput.value = `Create a ${template.name.toLowerCase()} project`
  showCreateDialog.value = true
}

async function executeWorkflow() {
  if (!currentWorkflow.value) return
  await executeWorkflowFn(currentWorkflow.value.workflowId)
}

async function pauseWorkflow() {
  if (!currentWorkflow.value) return
  await pauseWorkflowFn(currentWorkflow.value.workflowId)
}

async function resumeWorkflow() {
  if (!currentWorkflow.value) return
  await resumeWorkflowFn(currentWorkflow.value.workflowId)
}

async function cancelWorkflow() {
  if (!currentWorkflow.value) return
  
  if (confirm('Are you sure you want to cancel this workflow?')) {
    await cancelWorkflowFn(currentWorkflow.value.workflowId)
    stopStreamingUpdates()
  }
}

function startStreamingUpdates() {
  if (!currentWorkflow.value || unsubscribe.value) return
  
  unsubscribe.value = streamWorkflowUpdates(
    currentWorkflow.value.workflowId,
    (update) => {
      console.log('Workflow update:', update)
    }
  )
}

function stopStreamingUpdates() {
  if (unsubscribe.value) {
    unsubscribe.value()
    unsubscribe.value = null
  }
}

function formatTime(timestamp: Date): string {
  return new Date(timestamp).toLocaleTimeString()
}

// Lifecycle
onMounted(() => {
  if (currentWorkflow.value) {
    startStreamingUpdates()
  }
})

onUnmounted(() => {
  stopStreamingUpdates()
})
</script>

<style scoped>
.workflow-dashboard {
  @apply p-6;
}

.dashboard-header {
  @apply flex justify-between items-center mb-6;
}

.btn-primary {
  @apply flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
}

.btn-secondary {
  @apply flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors;
}

.btn-danger {
  @apply flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors;
}

.active-workflow {
  @apply space-y-6;
}

.workflow-card {
  @apply bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg;
}

.workflow-header {
  @apply flex justify-between items-center mb-4;
}

.workflow-status {
  @apply px-3 py-1 rounded-full text-sm font-medium;
}

.status-created {
  @apply bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300;
}

.status-in_progress {
  @apply bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300;
}

.status-paused {
  @apply bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300;
}

.status-completed {
  @apply bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300;
}

.status-cancelled {
  @apply bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300;
}

.workflow-description {
  @apply text-gray-600 dark:text-gray-400 mb-6;
}

.progress-container {
  @apply mb-6;
}

.progress-bar {
  @apply w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2;
}

.progress-fill {
  @apply h-full bg-blue-600 transition-all duration-500;
}

.progress-text {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.workflow-steps {
  @apply space-y-4 mb-6;
}

.workflow-step {
  @apply flex items-start gap-4 p-4 rounded-lg border;
}

.step-pending {
  @apply border-gray-200 dark:border-gray-700;
}

.step-in_progress {
  @apply border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20;
}

.step-completed {
  @apply border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20;
}

.step-indicator {
  @apply flex-shrink-0;
}

.step-content {
  @apply flex-1;
}

.step-name {
  @apply font-semibold mb-1;
}

.step-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mb-2;
}

.step-agents {
  @apply flex flex-wrap gap-2;
}

.agent-badge {
  @apply px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs;
}

.workflow-controls {
  @apply flex gap-3;
}

.workflow-updates {
  @apply bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg;
}

.updates-list {
  @apply space-y-2;
}

.update-item {
  @apply flex gap-3 text-sm;
}

.update-time {
  @apply text-gray-500 dark:text-gray-400 flex-shrink-0;
}

.update-message {
  @apply text-gray-700 dark:text-gray-300;
}

.no-workflow {
  @apply flex justify-center items-center min-h-[400px];
}

.empty-state {
  @apply text-center;
}

.templates-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4 mt-6;
}

.template-card {
  @apply p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors;
}

.template-name {
  @apply font-semibold mb-2;
}

.template-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mb-2;
}

.template-time {
  @apply text-xs text-gray-500 dark:text-gray-500;
}

.dialog-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
}

.dialog-content {
  @apply bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4;
}

.dialog-title {
  @apply text-xl font-semibold mb-4;
}

.form-group {
  @apply mb-4;
}

.form-group label {
  @apply block text-sm font-medium mb-2;
}

.form-textarea {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.dialog-actions {
  @apply flex justify-end gap-3;
}
</style>