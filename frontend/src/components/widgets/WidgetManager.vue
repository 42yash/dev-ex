<template>
  <div class="widget-manager">
    <component
      v-for="widget in widgets"
      :key="widget.id"
      :is="getWidgetComponent(widget.type)"
      :widget="widget"
      :data="widget.data"
      :config="widget.config"
      @interact="handleWidgetInteraction"
      @update="handleWidgetUpdate"
      @close="handleWidgetClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, defineAsyncComponent } from 'vue'
import { useWidgetStore } from '@/stores/widgets'
import { useWebSocket } from '@/composables/useWebSocket'

// Widget type definitions
export interface Widget {
  id: string
  type: string
  data: any
  config: WidgetConfig
  metadata?: any
}

export interface WidgetConfig {
  title?: string
  size?: 'small' | 'medium' | 'large' | 'full'
  position?: 'inline' | 'floating' | 'sidebar'
  interactive?: boolean
  closable?: boolean
  resizable?: boolean
  theme?: string
}

const props = defineProps<{
  widgets: Widget[]
  sessionId?: string
}>()

const emit = defineEmits<{
  'widget-interaction': [widget: Widget, interaction: any]
  'widget-update': [widget: Widget, update: any]
  'widget-close': [widgetId: string]
}>()

const widgetStore = useWidgetStore()
const { sendMessage } = useWebSocket()

// Lazy load widget components
const widgetComponents = {
  'code-editor': markRaw(defineAsyncComponent(() => import('./CodeEditorWidget.vue'))),
  'chart': markRaw(defineAsyncComponent(() => import('./ChartWidget.vue'))),
  'table': markRaw(defineAsyncComponent(() => import('./TableWidget.vue'))),
  'form': markRaw(defineAsyncComponent(() => import('./FormWidget.vue'))),
  'markdown': markRaw(defineAsyncComponent(() => import('./MarkdownWidget.vue'))),
  'terminal': markRaw(defineAsyncComponent(() => import('./TerminalWidget.vue'))),
  'file-tree': markRaw(defineAsyncComponent(() => import('./FileTreeWidget.vue'))),
  'diagram': markRaw(defineAsyncComponent(() => import('./DiagramWidget.vue'))),
  'media': markRaw(defineAsyncComponent(() => import('./MediaWidget.vue'))),
  'progress': markRaw(defineAsyncComponent(() => import('./ProgressWidget.vue'))),
  'alert': markRaw(defineAsyncComponent(() => import('./AlertWidget.vue'))),
  'quiz': markRaw(defineAsyncComponent(() => import('./QuizWidget.vue')))
}

// Get widget component by type
function getWidgetComponent(type: string) {
  return widgetComponents[type as keyof typeof widgetComponents] || widgetComponents['alert']
}

// Handle widget interactions
function handleWidgetInteraction(widget: Widget, interaction: any) {
  emit('widget-interaction', widget, interaction)
  
  // Send to backend via WebSocket
  if (props.sessionId) {
    sendMessage('widget:interaction', {
      sessionId: props.sessionId,
      widgetId: widget.id,
      widgetType: widget.type,
      interaction
    })
  }
  
  // Store interaction
  widgetStore.recordInteraction(widget.id, interaction)
}

// Handle widget updates
function handleWidgetUpdate(widget: Widget, update: any) {
  emit('widget-update', widget, update)
  widgetStore.updateWidget(widget.id, update)
}

// Handle widget close
function handleWidgetClose(widgetId: string) {
  emit('widget-close', widgetId)
  widgetStore.removeWidget(widgetId)
}
</script>

<style scoped>
.widget-manager {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>