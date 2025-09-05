<template>
  <div class="home-view">
    <div class="hero">
      <h1 class="hero-title">Dev-Ex Platform</h1>
      <p class="hero-subtitle">
        Autonomous Development Platform & Modular Documentation Q&A System
      </p>
      <div class="hero-actions">
        <button @click="startChat" class="btn btn-primary">
          Start Chat
        </button>
        <button @click="openDocs" class="btn btn-secondary">
          Documentation
        </button>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="feature-icon">🤖</div>
        <h3>AI-Powered Development</h3>
        <p>Accelerate your development with intelligent agents</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📚</div>
        <h3>Smart Documentation</h3>
        <p>Interactive pathways through technical documentation</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔧</div>
        <h3>Code Generation</h3>
        <p>Generate scaffolds and boilerplate automatically</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const startChat = () => {
  router.push('/chat')
}

const openDocs = () => {
  // Open documentation in new tab
  window.open('/docs', '_blank')
}
</script>

<style scoped lang="scss">
.home-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  min-height: 100vh;
}

.hero {
  text-align: center;
  margin: 4rem 0;

  &-title {
    font-size: 3.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-subtitle {
    font-size: 1.25rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }

  &-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &-primary {
    background: var(--accent);
    color: var(--bg-primary);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 255, 136, 0.3);
    }
  }

  &-secondary {
    background: transparent;
    color: var(--text-primary);
    border: 2px solid var(--border);

    &:hover {
      background: var(--bg-secondary);
    }
  }
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  width: 100%;
  margin-top: 4rem;
}

.feature-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-4px);
  }

  .feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  h3 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--text-secondary);
  }
}
</style>