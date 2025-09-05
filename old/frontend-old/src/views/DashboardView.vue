<template>
  <div class="dashboard-view">
    <div class="dashboard-container">
      <!-- Sidebar -->
      <aside class="dashboard-sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Dashboard</h2>
          <button @click="goToChat" class="btn-back-chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Chat
          </button>
        </div>
        
        <nav class="sidebar-nav">
          <button 
            v-for="item in navItems" 
            :key="item.id"
            @click="activeSection = item.id"
            :class="['nav-item', { active: activeSection === item.id }]"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar">{{ userInitial }}</div>
            <div class="user-details">
              <p class="user-name">{{ userName }}</p>
              <p class="user-email">{{ userEmail }}</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="dashboard-main">
        <!-- Overview Section -->
        <section v-if="activeSection === 'overview'" class="dashboard-section">
          <h1 class="section-title">Overview</h1>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <h3>Total Projects</h3>
                <p class="stat-value">{{ projects.length }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">💬</div>
              <div class="stat-content">
                <h3>Chat Sessions</h3>
                <p class="stat-value">{{ totalSessions }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📝</div>
              <div class="stat-content">
                <h3>Documents</h3>
                <p class="stat-value">{{ totalDocuments }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">⚡</div>
              <div class="stat-content">
                <h3>API Calls</h3>
                <p class="stat-value">{{ apiCalls }}</p>
              </div>
            </div>
          </div>

          <div class="recent-activity">
            <h2>Recent Activity</h2>
            <div class="activity-list">
              <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
                <span class="activity-icon">{{ activity.icon }}</span>
                <div class="activity-content">
                  <p>{{ activity.description }}</p>
                  <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Projects Section -->
        <section v-if="activeSection === 'projects'" class="dashboard-section">
          <div class="section-header">
            <h1 class="section-title">Projects</h1>
            <button @click="createNewProject" class="btn btn-primary">
              <span>+</span> New Project
            </button>
          </div>

          <div class="projects-grid">
            <div 
              v-for="project in projects" 
              :key="project.id"
              @click="selectProject(project)"
              :class="['project-card', { active: currentProject?.id === project.id }]"
            >
              <div class="project-header">
                <h3>{{ project.name }}</h3>
                <span class="project-status" :class="project.status">{{ project.status }}</span>
              </div>
              <p class="project-description">{{ project.description }}</p>
              <div class="project-footer">
                <span class="project-date">Created: {{ formatDate(project.createdAt) }}</span>
                <span class="project-sessions">{{ project.sessions }} sessions</span>
              </div>
            </div>
          </div>

          <div v-if="showProjectModal" class="modal-overlay" @click="closeProjectModal">
            <div class="modal-content" @click.stop>
              <h2>Create New Project</h2>
              <form @submit.prevent="handleCreateProject">
                <div class="form-group">
                  <label>Project Name</label>
                  <input 
                    v-model="newProject.name" 
                    type="text" 
                    required 
                    placeholder="Enter project name"
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea 
                    v-model="newProject.description" 
                    placeholder="Enter project description"
                    class="form-input"
                    rows="3"
                  ></textarea>
                </div>
                <div class="modal-actions">
                  <button type="button" @click="closeProjectModal" class="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" class="btn btn-primary">
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <!-- Settings Section -->
        <section v-if="activeSection === 'settings'" class="dashboard-section">
          <h1 class="section-title">Settings</h1>
          
          <div class="settings-container">
            <div class="settings-group">
              <h2>General Settings</h2>
              <div class="setting-item">
                <label class="setting-label">Theme</label>
                <select class="setting-control">
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              <div class="setting-item">
                <label class="setting-label">Language</label>
                <select class="setting-control">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>

            <div class="settings-group">
              <h2>AI Configuration</h2>
              <div class="setting-item">
                <label class="setting-label">Default Model</label>
                <select class="setting-control">
                  <option value="gemini">Gemini Pro</option>
                  <option value="gpt4">GPT-4</option>
                  <option value="claude">Claude</option>
                </select>
              </div>
              <div class="setting-item">
                <label class="setting-label">Temperature</label>
                <input type="range" min="0" max="1" step="0.1" value="0.7" class="setting-control">
              </div>
            </div>

            <div class="settings-actions">
              <button class="btn btn-secondary" @click="resetSettings">Reset to Default</button>
              <button class="btn btn-primary" @click="saveSettings">Save Settings</button>
            </div>
          </div>
        </section>

        <!-- Account Section -->
        <section v-if="activeSection === 'account'" class="dashboard-section">
          <h1 class="section-title">Account</h1>
          
          <div class="account-container">
            <div class="account-card">
              <h2>Profile Information</h2>
              <div class="profile-info">
                <div class="profile-avatar">{{ userInitial }}</div>
                <div class="profile-details">
                  <p class="profile-name">{{ userName }}</p>
                  <p class="profile-email">{{ userEmail }}</p>
                  <p class="profile-joined">Member since {{ memberSince }}</p>
                </div>
              </div>
            </div>

            <div class="account-card">
              <h2>Usage Statistics</h2>
              <div class="usage-stats">
                <div class="usage-item">
                  <span class="usage-label">Total Projects</span>
                  <span class="usage-value">{{ projects.length }}</span>
                </div>
                <div class="usage-item">
                  <span class="usage-label">Active Sessions</span>
                  <span class="usage-value">{{ totalSessions }}</span>
                </div>
                <div class="usage-item">
                  <span class="usage-label">Storage Used</span>
                  <span class="usage-value">2.3 GB</span>
                </div>
              </div>
            </div>

            <div class="account-card danger-zone">
              <h2>Danger Zone</h2>
              <p>Once you logout, you'll need to sign in again to access your projects.</p>
              <button class="btn btn-danger" @click="handleLogout">
                Logout
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Navigation
const activeSection = ref('overview')
const navItems = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'account', label: 'Account', icon: '👤' }
]

// Projects
const projects = ref([
  {
    id: '1',
    name: 'E-commerce Platform',
    description: 'Building a modern e-commerce solution with React and Node.js',
    status: 'active',
    createdAt: new Date('2024-01-15'),
    sessions: 24
  },
  {
    id: '2',
    name: 'Mobile App',
    description: 'Cross-platform mobile application using React Native',
    status: 'active',
    createdAt: new Date('2024-02-01'),
    sessions: 18
  },
  {
    id: '3',
    name: 'API Documentation',
    description: 'Comprehensive API documentation and testing suite',
    status: 'completed',
    createdAt: new Date('2023-12-10'),
    sessions: 45
  }
])

const currentProject = ref(projects.value[0])
const showProjectModal = ref(false)
const newProject = reactive({
  name: '',
  description: ''
})

// Stats
const totalSessions = computed(() => 
  projects.value.reduce((sum, p) => sum + p.sessions, 0)
)
const totalDocuments = ref(156)
const apiCalls = ref(1247)

// Recent Activities
const recentActivities = ref([
  {
    id: '1',
    icon: '💬',
    description: 'New chat session in E-commerce Platform',
    timestamp: new Date()
  },
  {
    id: '2',
    icon: '📝',
    description: 'Documentation updated for Mobile App',
    timestamp: new Date(Date.now() - 3600000)
  },
  {
    id: '3',
    icon: '✅',
    description: 'API Documentation project completed',
    timestamp: new Date(Date.now() - 7200000)
  }
])

// User Info
const userEmail = computed(() => {
  const user = localStorage.getItem('user')
  if (user) {
    try {
      return JSON.parse(user).email
    } catch {
      return 'demo@example.com'
    }
  }
  return 'demo@example.com'
})

const userName = computed(() => {
  const user = localStorage.getItem('user')
  if (user) {
    try {
      return JSON.parse(user).name || userEmail.value.split('@')[0]
    } catch {
      return userEmail.value.split('@')[0]
    }
  }
  return userEmail.value.split('@')[0]
})

const userInitial = computed(() => userName.value.charAt(0).toUpperCase())
const memberSince = computed(() => 'January 2024')

// Functions
const goToChat = () => {
  router.push('/chat')
}

const createNewProject = () => {
  showProjectModal.value = true
}

const closeProjectModal = () => {
  showProjectModal.value = false
  newProject.name = ''
  newProject.description = ''
}

const handleCreateProject = () => {
  const project = {
    id: Date.now().toString(),
    name: newProject.name,
    description: newProject.description,
    status: 'active',
    createdAt: new Date(),
    sessions: 0
  }
  projects.value.unshift(project)
  currentProject.value = project
  closeProjectModal()
}

const selectProject = (project: any) => {
  currentProject.value = project
  // Store current project in localStorage
  localStorage.setItem('currentProject', JSON.stringify(project))
}

const saveSettings = () => {
  alert('Settings saved successfully!')
}

const resetSettings = () => {
  alert('Settings reset to default!')
}

const handleLogout = () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  localStorage.removeItem('currentProject')
  router.push('/')
  setTimeout(() => window.location.reload(), 100)
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

const formatTime = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return formatDate(date)
}

onMounted(() => {
  // Load current project from localStorage
  const stored = localStorage.getItem('currentProject')
  if (stored) {
    try {
      const project = JSON.parse(stored)
      const found = projects.value.find(p => p.id === project.id)
      if (found) currentProject.value = found
    } catch {}
  }
})
</script>

<style scoped>
.dashboard-view {
  height: 100vh;
  display: flex;
  background: var(--bg-primary);
}

.dashboard-container {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Sidebar */
.dashboard-sidebar {
  width: 280px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 1rem;
}

.btn-back-chat {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all var(--transition-fast);
}

.btn-back-chat:hover {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
  transform: translateX(-2px);
}

.sidebar-nav {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.nav-item {
  width: 100%;
  padding: 0.875rem 1rem;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all var(--transition-fast);
  margin-bottom: 0.25rem;
  text-align: left;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.nav-item.active {
  background: rgba(0, 255, 136, 0.1);
  color: var(--accent);
  border-left: 3px solid var(--accent);
}

.nav-icon {
  font-size: 1.25rem;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.25rem;
}

.user-details {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.125rem;
}

.user-email {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Main Content */
.dashboard-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.dashboard-section {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all var(--transition-fast);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.stat-icon {
  font-size: 2rem;
}

.stat-content h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--accent);
}

/* Recent Activity */
.recent-activity {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.recent-activity h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
}

.activity-icon {
  font-size: 1.25rem;
}

.activity-content {
  flex: 1;
}

.activity-content p {
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Projects Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: var(--accent);
}

.project-card.active {
  border-color: var(--accent);
  background: rgba(0, 255, 136, 0.05);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.project-header h3 {
  font-size: 1.125rem;
  color: var(--text-primary);
}

.project-status {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.project-status.active {
  background: rgba(0, 255, 136, 0.2);
  color: var(--accent);
}

.project-status.completed {
  background: rgba(100, 100, 100, 0.2);
  color: var(--text-secondary);
}

.project-description {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.project-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  max-width: 500px;
  width: 90%;
}

.modal-content h2 {
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  font-weight: 500;
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

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

/* Settings */
.settings-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2rem;
}

.settings-group {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}

.settings-group:last-of-type {
  border-bottom: none;
}

.settings-group h2 {
  font-size: 1.25rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.setting-label {
  flex: 0 0 150px;
  color: var(--text-primary);
}

.setting-control {
  flex: 1;
  max-width: 300px;
  padding: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
}

.settings-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

/* Account */
.account-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.account-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.account-card h2 {
  font-size: 1.25rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
}

.profile-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.profile-email {
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.profile-joined {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.usage-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.usage-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
}

.usage-label {
  color: var(--text-secondary);
}

.usage-value {
  font-weight: 600;
  color: var(--accent);
}

.danger-zone {
  border-color: rgba(255, 68, 68, 0.3);
}

.danger-zone p {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.btn-primary:hover {
  background: var(--accent-secondary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
  color: var(--text-primary);
}

.btn-danger {
  background: var(--error);
  color: white;
}

.btn-danger:hover {
  background: #ff2222;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 68, 68, 0.4);
}

@media (max-width: 768px) {
  .dashboard-sidebar {
    width: 250px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
}
</style>