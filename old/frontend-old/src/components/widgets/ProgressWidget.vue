<template>
  <div class="widget-progress">
    <div class="progress-label">
      <span>{{ widget.data.label }}</span>
      <span>{{ widget.data.value }}%</span>
    </div>
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: `${widget.data.value}%` }"
      ></div>
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
.widget-progress {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.progress-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}
</style>
