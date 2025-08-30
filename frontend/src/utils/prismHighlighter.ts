/**
 * Advanced code highlighting using Prism.js
 */

import Prism from 'prismjs'

// Import core languages
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-markup' // HTML/XML
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-git'
import 'prismjs/components/prism-graphql'
import 'prismjs/components/prism-regex'

// Import plugins
import 'prismjs/plugins/line-numbers/prism-line-numbers'
import 'prismjs/plugins/line-highlight/prism-line-highlight'
import 'prismjs/plugins/toolbar/prism-toolbar'
import 'prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard'
import 'prismjs/plugins/show-language/prism-show-language'
import 'prismjs/plugins/match-braces/prism-match-braces'
import 'prismjs/plugins/diff-highlight/prism-diff-highlight'

// Import themes (will be conditionally loaded based on user preference)
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/plugins/line-numbers/prism-line-numbers.css'
import 'prismjs/plugins/line-highlight/prism-line-highlight.css'
import 'prismjs/plugins/toolbar/prism-toolbar.css'
import 'prismjs/plugins/match-braces/prism-match-braces.css'
import 'prismjs/plugins/diff-highlight/prism-diff-highlight.css'

export interface HighlightOptions {
  language?: string
  theme?: 'light' | 'dark' | 'high-contrast'
  showLineNumbers?: boolean
  highlightLines?: number[]
  showLanguage?: boolean
  enableCopy?: boolean
  wrapLongLines?: boolean
}

/**
 * Language aliases for common file extensions and names
 */
const languageAliases: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'jsx',
  'ts': 'typescript',
  'tsx': 'tsx',
  'py': 'python',
  'rb': 'ruby',
  'yml': 'yaml',
  'dockerfile': 'docker',
  'makefile': 'bash',
  'shell': 'bash',
  'sh': 'bash',
  'h': 'c',
  'hpp': 'cpp',
  'cc': 'cpp',
  'cs': 'csharp',
  'kt': 'kotlin',
  'rs': 'rust',
  'gql': 'graphql',
  'vue': 'markup', // Vue files are treated as markup
  'html': 'markup',
  'xml': 'markup',
  'svg': 'markup',
  'md': 'markdown'
}

/**
 * Highlight code using Prism.js
 */
export function highlightCode(code: string, options: HighlightOptions = {}): string {
  const {
    language = 'javascript',
    showLineNumbers = true,
    highlightLines = [],
    showLanguage = true,
    enableCopy = true,
    wrapLongLines = false
  } = options

  // Normalize language name
  const lang = normalizeLanguage(language)
  
  // Check if language is supported
  const grammar = Prism.languages[lang]
  if (!grammar) {
    console.warn(`Language "${lang}" not supported, falling back to plaintext`)
    return escapeHtml(code)
  }

  // Highlight the code
  const highlighted = Prism.highlight(code, grammar, lang)
  
  // Build wrapper with appropriate classes
  const classes = [
    'language-' + lang,
    showLineNumbers && 'line-numbers',
    highlightLines.length > 0 && 'line-highlight',
    wrapLongLines && 'wrap-long-lines'
  ].filter(Boolean).join(' ')
  
  // Build data attributes
  const dataAttrs = [
    highlightLines.length > 0 && `data-line="${highlightLines.join(',')}"`,
    showLanguage && `data-language="${lang}"`
  ].filter(Boolean).join(' ')
  
  // Wrap in pre and code tags
  const wrappedCode = `
    <pre class="${classes}" ${dataAttrs}>
      <code class="language-${lang}">${highlighted}</code>
    </pre>
  `
  
  // Add toolbar if needed
  if (enableCopy || showLanguage) {
    return wrapWithToolbar(wrappedCode, lang, code, { enableCopy, showLanguage })
  }
  
  return wrappedCode
}

/**
 * Highlight code in a DOM element
 */
export function highlightElement(element: HTMLElement, options: HighlightOptions = {}): void {
  // Set data attributes based on options
  if (options.showLineNumbers) {
    element.classList.add('line-numbers')
  }
  
  if (options.highlightLines && options.highlightLines.length > 0) {
    element.setAttribute('data-line', options.highlightLines.join(','))
  }
  
  // Use Prism's built-in highlightElement
  Prism.highlightElement(element)
}

/**
 * Highlight all code blocks in a container
 */
export function highlightAll(container?: HTMLElement): void {
  const target = container || document
  const codeBlocks = target.querySelectorAll('pre code')
  
  codeBlocks.forEach((block) => {
    if (block instanceof HTMLElement) {
      Prism.highlightElement(block)
    }
  })
}

/**
 * Normalize language name to Prism.js format
 */
function normalizeLanguage(language: string): string {
  const normalized = language.toLowerCase().trim()
  return languageAliases[normalized] || normalized
}

/**
 * Get language from file extension or name
 */
export function getLanguageFromFile(filename: string): string {
  // Check if it's a special filename
  const specialFiles: Record<string, string> = {
    'dockerfile': 'docker',
    'makefile': 'bash',
    '.gitignore': 'git',
    '.env': 'bash',
    'package.json': 'json',
    'tsconfig.json': 'json',
    'webpack.config.js': 'javascript',
    'vite.config.ts': 'typescript'
  }
  
  const lowerFilename = filename.toLowerCase()
  if (specialFiles[lowerFilename]) {
    return specialFiles[lowerFilename]
  }
  
  // Get extension
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return languageAliases[extension] || 'plaintext'
}

/**
 * Wrap code with toolbar for copy button and language display
 */
function wrapWithToolbar(
  code: string,
  language: string,
  rawCode: string,
  options: { enableCopy?: boolean; showLanguage?: boolean }
): string {
  const toolbar = []
  
  if (options.showLanguage) {
    toolbar.push(`<span class="code-language">${language}</span>`)
  }
  
  if (options.enableCopy) {
    toolbar.push(`
      <button class="copy-button" onclick="copyCode(this)" data-code="${escapeAttribute(rawCode)}">
        <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      </button>
    `)
  }
  
  return `
    <div class="code-block-wrapper">
      <div class="code-toolbar">
        ${toolbar.join('')}
      </div>
      ${code}
    </div>
  `
}

/**
 * Copy code to clipboard
 */
export async function copyCode(button: HTMLElement): Promise<void> {
  const code = button.getAttribute('data-code') || ''
  
  try {
    await navigator.clipboard.writeText(code)
    
    // Update button text
    const originalText = button.textContent
    button.textContent = 'Copied!'
    button.classList.add('copied')
    
    // Reset after 2 seconds
    setTimeout(() => {
      button.textContent = originalText
      button.classList.remove('copied')
    }, 2000)
  } catch (error) {
    console.error('Failed to copy code:', error)
    button.textContent = 'Failed'
    setTimeout(() => {
      button.textContent = 'Copy'
    }, 2000)
  }
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
 * Escape attribute value
 */
function escapeAttribute(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

/**
 * Format code with proper indentation
 */
export function formatCode(code: string, language: string = 'javascript'): string {
  // For now, return as-is. In production, you'd use prettier or similar
  return code
}

/**
 * Get Prism instance for advanced usage
 */
export function getPrism(): typeof Prism {
  return Prism
}

// Make copyCode available globally for onclick handlers
if (typeof window !== 'undefined') {
  (window as any).copyCode = copyCode
}