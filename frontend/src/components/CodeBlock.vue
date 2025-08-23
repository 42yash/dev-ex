<template>
  <div class="code-block">
    <div class="code-header">
      <span class="code-language">{{ displayLanguage }}</span>
      <button @click="copyCode" class="copy-btn" :title="copyButtonText">
        <svg v-if="!copied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        {{ copyButtonText }}
      </button>
    </div>
    <pre class="code-content"><code :class="`language-${language}`" v-html="highlightedCode"></code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Prism from 'prismjs'

// Import only the most common language support to avoid dependency issues
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-css'

// Import Prism theme (customized for dark mode)
import 'prismjs/themes/prism-tomorrow.css'

const props = defineProps<{
  code: string
  language?: string
}>()

const copied = ref(false)
const detectedLanguage = ref('')

const language = computed(() => props.language || detectedLanguage.value || 'plaintext')

const displayLanguage = computed(() => {
  const langMap: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    bash: 'Bash',
    json: 'JSON',
    sql: 'SQL',
    css: 'CSS',
    plaintext: 'Text'
  }
  return langMap[language.value] || language.value
})

const copyButtonText = computed(() => copied.value ? 'Copied!' : 'Copy')

const highlightedCode = computed(() => {
  try {
    if (Prism.languages[language.value]) {
      return Prism.highlight(props.code, Prism.languages[language.value], language.value)
    }
  } catch (error) {
    console.error('Syntax highlighting error:', error)
  }
  // Fallback to escaped HTML
  return escapeHtml(props.code)
})

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy code:', err)
  }
}

function detectLanguage() {
  // Simple language detection based on content patterns
  const code = props.code.toLowerCase()
  
  if (code.includes('function') || code.includes('const ') || code.includes('let ') || code.includes('var ')) {
    detectedLanguage.value = 'javascript'
  } else if (code.includes('def ') || code.includes('import ') || code.includes('class ') && code.includes(':')) {
    detectedLanguage.value = 'python'
  } else if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) {
    detectedLanguage.value = 'typescript'
  } else if (code.includes('#!/bin/bash') || code.includes('echo ') || code.includes('cd ')) {
    detectedLanguage.value = 'bash'
  } else if (code.startsWith('{') && code.includes('"')) {
    detectedLanguage.value = 'json'
  } else if (code.includes('SELECT ') || code.includes('FROM ') || code.includes('WHERE ')) {
    detectedLanguage.value = 'sql'
  } else if (code.includes('FROM ') || code.includes('RUN ') || code.includes('EXPOSE ')) {
    detectedLanguage.value = 'docker'
  }
}

onMounted(() => {
  if (!props.language) {
    detectLanguage()
  }
})
</script>

<style scoped>
.code-block {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 0.5rem 0;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(0, 255, 136, 0.05);
  border-bottom: 1px solid var(--border);
}

.code-language {
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--accent);
}

.copy-btn svg {
  flex-shrink: 0;
}

.code-content {
  padding: 1rem;
  overflow-x: auto;
  margin: 0;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

.code-content code {
  background: transparent;
  padding: 0;
  color: inherit;
}

/* Override Prism theme for better dark mode integration */
:deep(.token.comment),
:deep(.token.prolog),
:deep(.token.doctype),
:deep(.token.cdata) {
  color: #6a737d;
}

:deep(.token.punctuation) {
  color: #d1d5db;
}

:deep(.token.property),
:deep(.token.tag),
:deep(.token.boolean),
:deep(.token.number),
:deep(.token.constant),
:deep(.token.symbol),
:deep(.token.deleted) {
  color: #79c0ff;
}

:deep(.token.selector),
:deep(.token.attr-name),
:deep(.token.string),
:deep(.token.char),
:deep(.token.builtin),
:deep(.token.inserted) {
  color: #a5d6ff;
}

:deep(.token.operator),
:deep(.token.entity),
:deep(.token.url),
:deep(.language-css .token.string),
:deep(.style .token.string) {
  color: #ffab70;
}

:deep(.token.atrule),
:deep(.token.attr-value),
:deep(.token.keyword) {
  color: #ff7b72;
}

:deep(.token.function),
:deep(.token.class-name) {
  color: #d2a8ff;
}

:deep(.token.regex),
:deep(.token.important),
:deep(.token.variable) {
  color: #00ff88;
}
</style>