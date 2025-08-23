<template>
  <div class="login-view">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>Dev-Ex Platform</h1>
          <p>{{ isRegister ? 'Create your account' : 'Welcome back' }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="login-form">
          <div v-if="isRegister" class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              placeholder="Enter your name"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              placeholder="Enter your email"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              placeholder="Enter your password"
              required
              class="form-input"
            />
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="submit-button"
          >
            {{ isLoading ? 'Loading...' : (isRegister ? 'Sign Up' : 'Sign In') }}
          </button>
        </form>

        <div class="login-footer">
          <p>
            {{ isRegister ? 'Already have an account?' : "Don't have an account?" }}
            <a @click="toggleMode" class="toggle-link">
              {{ isRegister ? 'Sign In' : 'Sign Up' }}
            </a>
          </p>
          <div class="demo-info">
            <p>Demo credentials:</p>
            <code @click="useDemoCredentials" style="cursor: pointer;">demo@example.com / demo1234</code>
            <button @click="useDemoCredentials" class="demo-button">
              Use Demo Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const isRegister = ref(false)
const isLoading = ref(false)
const error = ref('')

const formData = reactive({
  name: '',
  email: '',
  password: ''
})

async function handleSubmit() {
  error.value = ''
  isLoading.value = true

  try {
    if (isRegister.value) {
      await authStore.register(
        formData.email,
        formData.password,
        formData.name
      )
    } else {
      await authStore.login(
        formData.email,
        formData.password
      )
    }
    // Auth store handles the redirect
  } catch (err: any) {
    error.value = err.message || 'Authentication failed'
  } finally {
    isLoading.value = false
  }
}

function toggleMode() {
  isRegister.value = !isRegister.value
  error.value = ''
  formData.name = ''
  formData.email = ''
  formData.password = ''
}

// Auto-fill demo credentials
function useDemoCredentials() {
  formData.email = 'demo@example.com'
  formData.password = 'demo1234'
}
</script>

<style scoped>
.login-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

.login-view::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
  opacity: 0.05;
  animation: pulse 10s ease-in-out infinite;
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 1rem;
  position: relative;
  z-index: 1;
}

.login-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  padding: 2rem;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.login-header p {
  color: var(--text-secondary);
  font-size: 1rem;
}

.login-form {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 1rem;
  transition: all var(--transition-fast);
}

.form-input::placeholder {
  color: var(--text-secondary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
  background: var(--bg-secondary);
}

.error-message {
  background: rgba(255, 68, 68, 0.1);
  color: var(--error);
  padding: 0.75rem;
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.submit-button {
  width: 100%;
  padding: 0.875rem;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.submit-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.submit-button:hover::before {
  width: 300px;
  height: 300px;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
  background: var(--accent-secondary);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-footer {
  text-align: center;
}

.login-footer p {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.toggle-link {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
  font-weight: 600;
  transition: color var(--transition-fast);
}

.toggle-link:hover {
  color: var(--accent-secondary);
  text-decoration: underline;
}

.demo-info {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.demo-info p {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.demo-info code {
  display: block;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--accent);
  font-family: 'Fira Code', 'Courier New', monospace;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.1) rotate(180deg);
  }
}

.demo-button {
  margin-top: 0.75rem;
  width: 100%;
  padding: 0.625rem;
  background: var(--bg-primary);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.demo-button:hover {
  background: var(--accent);
  color: var(--bg-primary);
}
</style>