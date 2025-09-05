<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">{{ errorTitle }}</h2>
      <p class="error-message">{{ errorMessage }}</p>
      
      <div class="error-details" v-if="showDetails && errorDetails">
        <details>
          <summary>Technical Details</summary>
          <pre>{{ errorDetails }}</pre>
        </details>
      </div>
      
      <div class="error-actions">
        <button @click="retry" class="btn-retry" v-if="onRetry">
          Try Again
        </button>
        <button @click="reset" class="btn-reset">
          Reset
        </button>
        <button @click="goHome" class="btn-home">
          Go Home
        </button>
      </div>
      
      <div class="error-report" v-if="allowReporting">
        <button @click="reportError" class="btn-report">
          Report This Error
        </button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLogger } from '@/composables/useLogger'

interface Props {
  fallback?: boolean
  showDetails?: boolean
  allowReporting?: boolean
  onRetry?: () => void
  errorTitle?: string
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  fallback: true,
  showDetails: false,
  allowReporting: true,
  errorTitle: 'Something went wrong',
  errorMessage: 'An unexpected error occurred. Please try again.'
})

const emit = defineEmits<{
  error: [error: Error, info: string]
  reset: []
}>()

const router = useRouter()
const logger = useLogger()

const hasError = ref(false)
const errorDetails = ref<string>('')
const errorInfo = ref<any>(null)

// Capture errors from child components
onErrorCaptured((error, instance, info) => {
  hasError.value = true
  errorDetails.value = `${error.name}: ${error.message}\n${error.stack}`
  errorInfo.value = { error, instance, info }
  
  // Log error
  logger.error('Component error caught', {
    error: error.message,
    stack: error.stack,
    component: instance?.$options.name || 'Unknown',
    info
  })
  
  // Emit error event
  emit('error', error, info)
  
  // Prevent error propagation if fallback is enabled
  return props.fallback
})

// Global error handler for unhandled promise rejections
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  hasError.value = true
  errorDetails.value = `Unhandled Promise Rejection: ${event.reason}`
  
  logger.error('Unhandled promise rejection', {
    reason: event.reason,
    promise: event.promise
  })
  
  // Prevent default error handling
  event.preventDefault()
}

// Global error handler for runtime errors
const handleGlobalError = (event: ErrorEvent) => {
  hasError.value = true
  errorDetails.value = `${event.error?.name || 'Error'}: ${event.message}`
  
  logger.error('Global error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  })
  
  // Prevent default error handling
  event.preventDefault()
}

onMounted(() => {
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  window.addEventListener('error', handleGlobalError)
})

onUnmounted(() => {
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  window.removeEventListener('error', handleGlobalError)
})

const retry = () => {
  if (props.onRetry) {
    hasError.value = false
    errorDetails.value = ''
    props.onRetry()
  }
}

const reset = () => {
  hasError.value = false
  errorDetails.value = ''
  errorInfo.value = null
  emit('reset')
  
  // Force re-render of child components
  window.location.reload()
}

const goHome = () => {
  hasError.value = false
  router.push('/')
}

const reportError = async () => {
  try {
    // Send error report to backend
    const report = {
      error: errorDetails.value,
      info: errorInfo.value,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }
    
    await fetch('/api/v1/errors/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report)
    })
    
    alert('Error reported successfully. Thank you!')
  } catch (err) {
    console.error('Failed to report error:', err)
    alert('Failed to report error. Please try again later.')
  }
}
</script>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.error-container {
  background: white;
  border-radius: 1rem;
  padding: 3rem;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.75rem;
  font-weight: bold;
  color: #2d3748;
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1.1rem;
  color: #4a5568;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.error-details {
  margin: 2rem 0;
  text-align: left;
}

.error-details details {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
}

.error-details summary {
  cursor: pointer;
  font-weight: 600;
  color: #2d3748;
  user-select: none;
}

.error-details pre {
  margin-top: 1rem;
  padding: 1rem;
  background: #2d3748;
  color: #f7fafc;
  border-radius: 0.25rem;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.error-actions button {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-retry {
  background: #48bb78;
  color: white;
}

.btn-retry:hover {
  background: #38a169;
  transform: translateY(-2px);
}

.btn-reset {
  background: #ed8936;
  color: white;
}

.btn-reset:hover {
  background: #dd6b20;
  transform: translateY(-2px);
}

.btn-home {
  background: #667eea;
  color: white;
}

.btn-home:hover {
  background: #5a67d8;
  transform: translateY(-2px);
}

.error-report {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.btn-report {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #667eea;
  border: 1px solid #667eea;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-report:hover {
  background: #667eea;
  color: white;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-boundary {
    background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  }
  
  .error-container {
    background: #2d3748;
    color: #f7fafc;
  }
  
  .error-title {
    color: #f7fafc;
  }
  
  .error-message {
    color: #e2e8f0;
  }
  
  .error-details details {
    background: #1a202c;
    border-color: #4a5568;
  }
  
  .error-details summary {
    color: #f7fafc;
  }
}
</style>