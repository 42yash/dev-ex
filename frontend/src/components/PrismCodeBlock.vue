<template>
  <div class="prism-code-block" :class="containerClasses">
    <div v-if="showHeader" class="code-header">
      <span v-if="filename" class="code-filename">{{ filename }}</span>
      <span v-if="showLanguage && !filename" class="code-language">{{ displayLanguage }}</span>
      <div class="code-actions">
        <button
          v-if="enableCopy"
          @click="handleCopy"
          class="copy-button"
          :class="{ copied: isCopied }"
        >
          <svg v-if="!isCopied" class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <svg v-else class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {{ copyButtonText }}
        </button>
        <button
          v-if="collapsible"
          @click="isCollapsed = !isCollapsed"
          class="collapse-button"
        >
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline :points="isCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'"></polyline>
          </svg>
        </button>
      </div>
    </div>
    
    <div
      v-show="!isCollapsed"
      ref="codeContainer"
      class="code-container"
      :style="containerStyle"
    >
      <pre
        ref="preElement"
        :class="preClasses"
        :data-line="highlightedLines"
      ><code
        ref="codeElement"
        :class="`language-${language}`"
        v-html="highlightedCode"
      ></code></pre>
    </div>
    
    <div v-if="showFooter && !isCollapsed" class="code-footer">
      <span class="line-count">{{ lineCount }} lines</span>
      <span v-if="characterCount" class="char-count">{{ characterCount }} characters</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  highlightCode,
  highlightElement,
  getLanguageFromFile,
  type HighlightOptions
} from '@/utils/prismHighlighter'

interface Props {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  showLanguage?: boolean
  enableCopy?: boolean
  wrapLongLines?: boolean
  collapsible?: boolean
  collapsed?: boolean
  maxHeight?: string
  theme?: 'light' | 'dark' | 'high-contrast'
  showHeader?: boolean
  showFooter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  language: 'javascript',
  showLineNumbers: true,
  highlightLines: () => [],
  showLanguage: true,
  enableCopy: true,
  wrapLongLines: false,
  collapsible: false,
  collapsed: false,
  maxHeight: '500px',
  theme: 'dark',
  showHeader: true,
  showFooter: false
})

const emit = defineEmits<{
  copy: [code: string]
  collapse: [collapsed: boolean]
}>()

// Refs
const preElement = ref<HTMLPreElement>()
const codeElement = ref<HTMLElement>()
const codeContainer = ref<HTMLDivElement>()
const isCopied = ref(false)
const isCollapsed = ref(props.collapsed)
const highlightedCode = ref('')

// Computed
const actualLanguage = computed(() => {
  if (props.filename) {
    return getLanguageFromFile(props.filename)
  }
  return props.language
})

const displayLanguage = computed(() => {
  const lang = actualLanguage.value
  // Capitalize first letter
  return lang.charAt(0).toUpperCase() + lang.slice(1)
})

const containerClasses = computed(() => [
  `theme-${props.theme}`,
  props.wrapLongLines && 'wrap-lines',
  isCollapsed.value && 'collapsed'
])

const preClasses = computed(() => [
  `language-${actualLanguage.value}`,
  props.showLineNumbers && 'line-numbers',
  props.highlightLines.length > 0 && 'line-highlight'
])

const highlightedLines = computed(() => 
  props.highlightLines.length > 0 ? props.highlightLines.join(',') : undefined
)

const containerStyle = computed(() => ({
  maxHeight: props.maxHeight,
  overflow: 'auto'
}))

const lineCount = computed(() => {
  return props.code.split('\n').length
})

const characterCount = computed(() => {
  return props.code.length
})

const copyButtonText = computed(() => {
  return isCopied.value ? 'Copied!' : 'Copy'
})

// Methods
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.code)
    isCopied.value = true
    emit('copy', props.code)
    
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy code:', error)
  }
}

function updateHighlight() {
  const options: HighlightOptions = {
    language: actualLanguage.value,
    showLineNumbers: props.showLineNumbers,
    highlightLines: props.highlightLines,
    showLanguage: false, // We handle this in the template
    enableCopy: false, // We handle this in the template
    wrapLongLines: props.wrapLongLines
  }
  
  // Use Prism to highlight
  highlightedCode.value = highlightCode(props.code, options)
  
  // Re-apply Prism plugins after DOM update
  nextTick(() => {
    if (codeElement.value) {
      // Apply line numbers plugin
      if (props.showLineNumbers && preElement.value) {
        preElement.value.classList.add('line-numbers')
      }
      
      // Apply line highlight plugin
      if (props.highlightLines.length > 0 && preElement.value) {
        preElement.value.setAttribute('data-line', props.highlightLines.join(','))
      }
    }
  })
}

// Watch for changes
watch(() => props.code, updateHighlight)
watch(() => props.language, updateHighlight)
watch(() => props.filename, updateHighlight)
watch(() => props.highlightLines, updateHighlight, { deep: true })

watch(isCollapsed, (value) => {
  emit('collapse', value)
})

// Initialize
onMounted(() => {
  updateHighlight()
})
</script>

<style scoped>
.prism-code-block {
  border-radius: 8px;
  overflow: hidden;
  background: var(--code-bg, #1e1e1e);
  border: 1px solid var(--code-border, #333);
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--code-header-bg, #2d2d2d);
  border-bottom: 1px solid var(--code-border, #333);
}

.code-filename,
.code-language {
  font-size: 12px;
  color: var(--code-header-text, #888);
  font-weight: 500;
}

.code-actions {
  display: flex;
  gap: 8px;
}

.copy-button,
.collapse-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--code-border, #444);
  border-radius: 4px;
  color: var(--code-header-text, #888);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-button:hover,
.collapse-button:hover {
  background: var(--code-hover-bg, #3a3a3a);
  color: var(--code-hover-text, #fff);
  border-color: var(--code-hover-border, #555);
}

.copy-button.copied {
  color: var(--success-color, #4caf50);
  border-color: var(--success-color, #4caf50);
}

.icon {
  width: 14px;
  height: 14px;
}

.code-container {
  position: relative;
  overflow: auto;
}

.code-container pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.code-container pre.line-numbers {
  padding-left: 3.8em;
  counter-reset: linenumber;
}

.code-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--code-header-bg, #2d2d2d);
  border-top: 1px solid var(--code-border, #333);
  font-size: 11px;
  color: var(--code-header-text, #888);
}

/* Theme variations */
.theme-light {
  --code-bg: #f5f5f5;
  --code-border: #ddd;
  --code-header-bg: #fff;
  --code-header-text: #666;
  --code-hover-bg: #f0f0f0;
  --code-hover-text: #333;
  --code-hover-border: #bbb;
}

.theme-dark {
  --code-bg: #1e1e1e;
  --code-border: #333;
  --code-header-bg: #2d2d2d;
  --code-header-text: #888;
  --code-hover-bg: #3a3a3a;
  --code-hover-text: #fff;
  --code-hover-border: #555;
}

.theme-high-contrast {
  --code-bg: #000;
  --code-border: #fff;
  --code-header-bg: #111;
  --code-header-text: #fff;
  --code-hover-bg: #222;
  --code-hover-text: #fff;
  --code-hover-border: #fff;
}

/* Wrap long lines */
.wrap-lines pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Collapsed state */
.collapsed .code-container {
  display: none;
}
</style>