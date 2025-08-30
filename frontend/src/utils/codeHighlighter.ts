/**
 * Code highlighting utility for syntax highlighting
 */

export interface HighlightOptions {
  language?: string
  theme?: 'light' | 'dark'
  showLineNumbers?: boolean
}

/**
 * Simple code highlighter that adds basic syntax highlighting
 * In production, you would use a library like Prism.js or highlight.js
 */
export function highlightCode(code: string, options: HighlightOptions = {}): string {
  const { language = 'javascript', theme = 'dark', showLineNumbers = true } = options
  
  // Basic keyword highlighting for common languages
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while', 'return', 'import', 'export', 'async', 'await', 'try', 'catch'],
    typescript: ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'if', 'else', 'for', 'while', 'return', 'import', 'export', 'async', 'await', 'try', 'catch'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'async', 'await'],
    vue: ['template', 'script', 'style', 'setup', 'ref', 'computed', 'watch', 'onMounted', 'defineProps', 'defineEmits'],
    html: ['div', 'span', 'p', 'a', 'img', 'h1', 'h2', 'h3', 'button', 'input', 'form'],
    css: ['color', 'background', 'margin', 'padding', 'border', 'display', 'position', 'width', 'height', 'flex']
  }
  
  let highlighted = escapeHtml(code)
  
  // Apply keyword highlighting
  const languageKeywords = keywords[language.toLowerCase()] || keywords.javascript
  languageKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g')
    highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`)
  })
  
  // Highlight strings
  highlighted = highlighted.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="string">$&</span>')
  
  // Highlight comments
  highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="comment">$&</span>')
  highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$&</span>')
  
  // Highlight numbers
  highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
  
  // Add line numbers if requested
  if (showLineNumbers) {
    const lines = highlighted.split('\n')
    highlighted = lines
      .map((line, index) => {
        const lineNumber = String(index + 1).padStart(3, ' ')
        return `<span class="line-number">${lineNumber}</span>${line}`
      })
      .join('\n')
  }
  
  return highlighted
}

/**
 * Get language from file extension
 */
export function getLanguageFromExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  
  const extensionMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    vue: 'vue',
    html: 'html',
    css: 'css',
    scss: 'css',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml'
  }
  
  return extensionMap[extension] || 'plaintext'
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  
  return text.replace(/[&<>"'/]/g, char => map[char])
}

/**
 * Format code with proper indentation
 */
export function formatCode(code: string, indent: number = 2): string {
  // Basic code formatting
  let formatted = code
  let level = 0
  const lines = formatted.split('\n')
  
  const formattedLines = lines.map(line => {
    const trimmed = line.trim()
    
    // Decrease indent for closing brackets
    if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
      level = Math.max(0, level - 1)
    }
    
    const indented = ' '.repeat(level * indent) + trimmed
    
    // Increase indent for opening brackets
    if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
      level++
    }
    
    return indented
  })
  
  return formattedLines.join('\n')
}

/**
 * Copy code to clipboard
 */
export async function copyToClipboard(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}