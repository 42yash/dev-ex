import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Widget {
  id: string
  type: string
  content?: string
  data?: any
  metadata?: Record<string, any>
}

export interface WidgetEvent {
  widgetId: string
  action?: string
  data?: any
}

export const useWidgetStore = defineStore('widgets', () => {
  // State
  const activeWidgets = ref<Map<string, Widget>>(new Map())
  const widgetData = ref<Map<string, any>>(new Map())
  const formData = ref<Record<string, any>>({})
  const isFormValid = ref(true)
  const widgetErrors = ref<Map<string, string>>(new Map())
  
  // Computed
  const hasActiveWidgets = computed(() => activeWidgets.value.size > 0)
  
  const getWidget = computed(() => (widgetId: string) => {
    return activeWidgets.value.get(widgetId)
  })
  
  const getWidgetData = computed(() => (widgetId: string) => {
    return widgetData.value.get(widgetId)
  })
  
  // Actions
  function registerWidget(widget: Widget) {
    activeWidgets.value.set(widget.id, widget)
    
    // Initialize widget data if needed
    if (widget.type === 'form' && widget.data?.fields) {
      const initialData: Record<string, any> = {}
      widget.data.fields.forEach((field: any) => {
        initialData[field.name] = field.defaultValue || ''
      })
      widgetData.value.set(widget.id, initialData)
    }
  }
  
  function unregisterWidget(widgetId: string) {
    activeWidgets.value.delete(widgetId)
    widgetData.value.delete(widgetId)
    widgetErrors.value.delete(widgetId)
  }
  
  function updateWidgetData(widgetId: string, data: any) {
    widgetData.value.set(widgetId, data)
    
    // Update form data if it's a form widget
    const widget = activeWidgets.value.get(widgetId)
    if (widget?.type === 'form') {
      formData.value = { ...formData.value, ...data }
      validateForm(widgetId)
    }
  }
  
  function handleWidgetEvent(event: WidgetEvent) {
    console.log('Widget event received:', event)
    
    const widget = activeWidgets.value.get(event.widgetId)
    if (!widget) {
      console.warn(`Widget ${event.widgetId} not found`)
      return
    }
    
    switch (event.action) {
      case 'submit':
        handleFormSubmit(event.widgetId, event.data)
        break
      case 'cancel':
        handleFormCancel(event.widgetId)
        break
      case 'click':
        handleButtonClick(event.widgetId, event.data)
        break
      case 'change':
        updateWidgetData(event.widgetId, event.data)
        break
      default:
        console.log('Unhandled widget action:', event.action)
    }
  }
  
  function handleFormSubmit(widgetId: string, data: any) {
    console.log('Form submitted:', { widgetId, data })
    
    // Validate before submission
    if (!validateForm(widgetId)) {
      console.warn('Form validation failed')
      return
    }
    
    // Store the submitted data
    widgetData.value.set(widgetId, data)
    
    // Clear form after submission
    clearWidget(widgetId)
  }
  
  function handleFormCancel(widgetId: string) {
    console.log('Form cancelled:', widgetId)
    clearWidget(widgetId)
  }
  
  function handleButtonClick(widgetId: string, data: any) {
    console.log('Button clicked:', { widgetId, data })
    // Handle button click action
    // This could trigger navigation, API calls, etc.
  }
  
  function validateForm(widgetId: string): boolean {
    const widget = activeWidgets.value.get(widgetId)
    if (!widget || widget.type !== 'form') return true
    
    const data = widgetData.value.get(widgetId) || {}
    const fields = widget.data?.fields || []
    let isValid = true
    
    fields.forEach((field: any) => {
      if (field.required && !data[field.name]) {
        widgetErrors.value.set(`${widgetId}-${field.name}`, `${field.label} is required`)
        isValid = false
      } else {
        widgetErrors.value.delete(`${widgetId}-${field.name}`)
      }
      
      // Additional validation based on field type
      if (field.type === 'email' && data[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(data[field.name])) {
          widgetErrors.value.set(`${widgetId}-${field.name}`, `Invalid email address`)
          isValid = false
        }
      }
      
      if (field.type === 'number' && data[field.name]) {
        if (isNaN(Number(data[field.name]))) {
          widgetErrors.value.set(`${widgetId}-${field.name}`, `Must be a number`)
          isValid = false
        }
      }
    })
    
    isFormValid.value = isValid
    return isValid
  }
  
  function clearWidget(widgetId: string) {
    const widget = activeWidgets.value.get(widgetId)
    if (widget?.type === 'form') {
      // Reset form data
      const fields = widget.data?.fields || []
      const resetData: Record<string, any> = {}
      fields.forEach((field: any) => {
        resetData[field.name] = field.defaultValue || ''
      })
      widgetData.value.set(widgetId, resetData)
      
      // Clear errors
      fields.forEach((field: any) => {
        widgetErrors.value.delete(`${widgetId}-${field.name}`)
      })
    } else {
      widgetData.value.delete(widgetId)
    }
  }
  
  function clearWidgets() {
    activeWidgets.value.clear()
    widgetData.value.clear()
    widgetErrors.value.clear()
    formData.value = {}
    isFormValid.value = true
  }
  
  function getWidgetError(widgetId: string, fieldName?: string): string | undefined {
    const key = fieldName ? `${widgetId}-${fieldName}` : widgetId
    return widgetErrors.value.get(key)
  }
  
  // Parse widgets from message content
  function parseWidgetsFromMessage(content: string): Widget[] {
    const widgets: Widget[] = []
    
    // Look for widget markers in the content
    // Format: <<<WIDGET:type:id:data>>>
    const widgetRegex = /<<<WIDGET:(\w+):([^:]+):(.+?)>>>/g
    let match
    
    while ((match = widgetRegex.exec(content)) !== null) {
      try {
        const [, type, id, dataStr] = match
        const data = JSON.parse(dataStr)
        widgets.push({ id, type, data })
      } catch (error) {
        console.error('Failed to parse widget:', error)
      }
    }
    
    return widgets
  }
  
  // Create widget from configuration
  function createWidget(config: any): Widget {
    const id = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      id,
      type: config.type,
      content: config.content,
      data: config.data,
      metadata: config.metadata
    }
  }
  
  return {
    // State
    activeWidgets,
    widgetData,
    formData,
    isFormValid,
    widgetErrors,
    
    // Computed
    hasActiveWidgets,
    getWidget,
    getWidgetData,
    
    // Actions
    registerWidget,
    unregisterWidget,
    updateWidgetData,
    handleWidgetEvent,
    validateForm,
    clearWidget,
    clearWidgets,
    getWidgetError,
    parseWidgetsFromMessage,
    createWidget
  }
})