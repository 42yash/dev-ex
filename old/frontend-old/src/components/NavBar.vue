<template>
  <nav class="navbar">
    <div class="nav-container">
      <RouterLink to="/" class="nav-brand">
        Dev-Ex Platform
      </RouterLink>
      
      <div class="nav-links">
        <RouterLink to="/" class="nav-link">Home</RouterLink>
        <RouterLink to="/chat" class="nav-link">Chat</RouterLink>
        <RouterLink to="/settings" class="nav-link">Settings</RouterLink>
        
        <div v-if="isAuthenticated" class="nav-user">
          <span class="user-email">{{ userEmail }}</span>
          <button @click="handleLogout" class="btn-logout">Logout</button>
        </div>
        <RouterLink v-else to="/login" class="btn-login">Login</RouterLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

const router = useRouter()

// Simple auth check based on localStorage
const isAuthenticated = computed(() => {
  return !!localStorage.getItem('accessToken')
})

const userEmail = computed(() => {
  const user = localStorage.getItem('user')
  if (user) {
    try {
      return JSON.parse(user).email
    } catch {
      return ''
    }
  }
  return ''
})

function handleLogout() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
  router.push('/')
}
</script>

<style scoped>
.navbar {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  background: rgba(26, 26, 26, 0.95);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand {
  font-size: 1.25rem;
  font-weight: 700;
  text-decoration: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast);
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--accent);
  transition: width var(--transition-fast);
}

.nav-link:hover {
  color: var(--text-primary);
}

.nav-link:hover::after {
  width: 100%;
}

.nav-link.router-link-active {
  color: var(--accent);
}

.nav-link.router-link-active::after {
  width: 100%;
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.btn-logout,
.btn-login {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all var(--transition-fast);
  cursor: pointer;
  text-decoration: none;
}

.btn-logout {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-logout:hover {
  background: var(--border);
  color: var(--text-primary);
}

.btn-login {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  display: inline-block;
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
  background: var(--accent-secondary);
}
</style>