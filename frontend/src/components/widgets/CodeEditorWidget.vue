<template>
  <div class="code-editor-widget" :class="`size-${config.size || 'medium'}`">
    <div class="widget-header" v-if="config.title">
      <h3>{{ config.title }}</h3>
      <div class="widget-actions">
        <button @click="copyCode" class="btn-icon" title="Copy code">
          <span>📋</span>
        </button>
        <button @click="runCode" class="btn-icon" title="Run code" v-if="config.runnable">
          <span>▶️</span>
        </button>
        <button @click="close" class="btn-icon" title="Close" v-if="config.closable">
          <span>✕</span>
        </button>
      </div>
    </div>
    
    <div class="editor-container">
      <div class="editor-toolbar">
        <select v-model="language" @change="updateLanguage">
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="sql">SQL</option>
          <option value="json">JSON</option>
          <option value="yaml">YAML</option>
        </select>
        <span class="editor-info">{{ lineCount }} lines</span>
      </div>
      
      <div class="editor-wrapper">
        <div class="line-numbers">
          <div v-for="n in lineCount" :key="n" class="line-number">{{ n }}</div>
        </div>
        <textarea
          ref="editorRef"
          v-model="code"
          @input="handleInput"
          @keydown="handleKeydown"
          class="code-editor"
          :spellcheck="false"
          :placeholder="placeholder"
        />
        <pre class="code-highlight" v-html="highlightedCode"></pre>
      </div>
    </div>
    
    <div class="editor-output" v-if="output">
      <div class="output-header">
        <span>Output</span>
        <button @click="clearOutput" class="btn-sm">Clear</button>
      </div>
      <pre class="output-content" :class="outputType">{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { highlightCode } from '@/utils/codeHighlighter'

interface Props {
  widget: {
    id: string
    type: string
    data: {
      code?: string
      language?: string
      runnable?: boolean
    }
  }
  config: {
    title?: string
    size?: string
    closable?: boolean
    runnable?: boolean
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  interact: [widget: any, interaction: any]
  update: [widget: any, update: any]
  close: [widgetId: string]
}>()

const editorRef = ref<HTMLTextAreaElement>()
const code = ref(props.widget.data.code || '')
const language = ref(props.widget.data.language || 'javascript')
const output = ref('')
const outputType = ref<'success' | 'error'>('success')

const placeholder = computed(() => `Enter ${language.value} code here...`)
const lineCount = computed(() => code.value.split('\n').length)
const highlightedCode = computed(() => highlightCode(code.value, language.value))

// Handle code input
function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  code.value = target.value
  
  emit('update', props.widget, {
    data: { code: code.value }
  })
}

// Handle keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  // Tab key handling
  if (event.key === 'Tab') {
    event.preventDefault()
    const start = editorRef.value!.selectionStart
    const end = editorRef.value!.selectionEnd
    
    // Insert tab
    code.value = code.value.substring(0, start) + '  ' + code.value.substring(end)
    
    // Move cursor
    setTimeout(() => {
      editorRef.value!.selectionStart = editorRef.value!.selectionEnd = start + 2
    }, 0)
  }
  
  // Ctrl/Cmd + Enter to run
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    runCode()
  }
  
  // Ctrl/Cmd + S to save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    saveCode()
  }
}

// Copy code to clipboard
async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    emit('interact', props.widget, {
      action: 'copy',
      code: code.value,
      language: language.value
    })
  } catch (error) {
    console.error('Failed to copy code:', error)
  }
}

// Run code (simplified - would need backend execution)
async function runCode() {
  output.value = 'Running...'
  outputType.value = 'success'
  
  emit('interact', props.widget, {
    action: 'run',
    code: code.value,
    language: language.value
  })
  
  // Simulate execution (in real app, this would call backend)
  setTimeout(() => {
    try {
      if (language.value === 'javascript') {
        // Simple JS evaluation (not safe for production!)
        const result = eval(code.value)
        output.value = String(result)
      } else {
        output.value = `${language.value} execution not implemented in demo`
      }
    } catch (error: any) {
      output.value = `Error: ${error.message}`
      outputType.value = 'error'
    }
  }, 500)
}

// Save code
function saveCode() {
  emit('interact', props.widget, {
    action: 'save',
    code: code.value,
    language: language.value
  })
}

// Update language
function updateLanguage() {
  emit('update', props.widget, {
    data: { language: language.value }
  })
}

// Clear output
function clearOutput() {
  output.value = ''
}

// Close widget
function close() {
  emit('close', props.widget.id)
}

// Auto-resize textarea
watch(code, () => {
  if (editorRef.value) {
    editorRef.value.style.height = 'auto'
    editorRef.value.style.height = editorRef.value.scrollHeight + 'px'
  }
})

onMounted(() => {
  if (editorRef.value) {
    editorRef.value.style.height = editorRef.value.scrollHeight + 'px'
  }
})
</script>

<style scoped>
.code-editor-widget {
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
}

.size-small {
  max-height: 200px;
}

.size-medium {
  max-height: 400px;
}

.size-large {
  max-height: 600px;
}

.size-full {
  height: 100%;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.widget-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.widget-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #e2e8f0;
}

.editor-container {
  position: relative;
  height: calc(100% - 60px);
  overflow: auto;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.editor-toolbar select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #cbd5e0;
  border-radius: 0.25rem;
  background: white;
}

.editor-info {
  font-size: 0.875rem;
  color: #718096;
}

.editor-wrapper {
  position: relative;
  display: flex;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.line-numbers {
  padding: 1rem 0.5rem;
  background: #f7fafc;
  border-right: 1px solid #e2e8f0;
  user-select: none;
}

.line-number {
  color: #a0aec0;
  text-align: right;
  min-width: 2rem;
}

.code-editor {
  flex: 1;
  padding: 1rem;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  background: transparent;
  color: transparent;
  caret-color: black;
  position: absolute;
  left: 3rem;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 2;
}

.code-highlight {
  flex: 1;
  padding: 1rem;
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: #2d3748;
  pointer-events: none;
  position: absolute;
  left: 3rem;
  right: 0;
  top: 0;
  z-index: 1;
}

.editor-output {
  border-top: 1px solid #e2e8f0;
  max-height: 200px;
  overflow: auto;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.output-content {
  padding: 1rem;
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  background: #1a202c;
  color: #68d391;
}

.output-content.error {
  color: #fc8181;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: white;
  border: 1px solid #cbd5e0;
  border-radius: 0.25rem;
  cursor: pointer;
}

.btn-sm:hover {
  background: #f7fafc;
}
</style>