<template>
  <div :class="['widget-alert', `alert-${widget.data.variant || 'info'}`]">
    <div class="alert-icon">
      <span v-if="widget.data.variant === 'success'">✓</span>
      <span v-else-if="widget.data.variant === 'warning'">⚠</span>
      <span v-else-if="widget.data.variant === 'error'">✕</span>
      <span v-else>ℹ</span>
    </div>
    <div class="alert-content">
      <h4 v-if="widget.data.title">{{ widget.data.title }}</h4>
      <p>{{ widget.data.content }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Widget } from './WidgetManager.vue';

defineProps<{
  widget: Widget;
}>();
</script>

<style scoped>
.widget-alert {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--radius);
  margin: 1rem 0;
}

.widget-alert.alert-info {
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(0, 123, 255, 0.3);
  color: #4da6ff;
}

.widget-alert.alert-success {
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.3);
  color: var(--accent);
}

.widget-alert.alert-warning {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ffc107;
}

.widget-alert.alert-error {
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.3);
  color: #ff5252;
}

.alert-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.alert-content {
  flex: 1;
}

.alert-content h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.alert-content p {
  margin: 0;
  line-height: 1.5;
}
</style>
