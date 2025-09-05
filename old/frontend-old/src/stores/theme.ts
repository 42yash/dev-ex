import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'dark' | 'light' | 'auto'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<Theme>('dark')

  const themes = {
    dark: {
      '--bg-primary': '#0a0a0a',
      '--bg-secondary': '#1a1a1a',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#a0a0a0',
      '--accent': '#00ff88',
      '--accent-secondary': '#00cc6a',
      '--border': '#333333',
      '--error': '#ff4444',
      '--warning': '#ffaa00',
      '--success': '#00ff88'
    },
    light: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f5f5f5',
      '--text-primary': '#1a1a1a',
      '--text-secondary': '#666666',
      '--accent': '#0066ff',
      '--accent-secondary': '#0052cc',
      '--border': '#e0e0e0',
      '--error': '#cc0000',
      '--warning': '#ff8800',
      '--success': '#00aa44'
    }
  }

  function setTheme(theme: Theme) {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(prefersDark ? 'dark' : 'light')
    } else {
      applyTheme(theme)
    }
    currentTheme.value = theme
    localStorage.setItem('theme', theme)
  }

  function applyTheme(theme: 'dark' | 'light') {
    const root = document.documentElement
    const themeVars = themes[theme]
    
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }

  function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') as Theme
    setTheme(savedTheme || 'dark')
  }

  return {
    currentTheme,
    themes,
    setTheme,
    initializeTheme
  }
})