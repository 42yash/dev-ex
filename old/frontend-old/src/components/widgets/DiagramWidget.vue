<template>
  <div class="widget-diagram">
    <div :id="`diagram-${widget.id}`" class="mermaid">
      {{ widget.data.content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import mermaid from 'mermaid';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

onMounted(() => {
  mermaid.initialize({ startOnLoad: true });
  mermaid.contentLoaded();
});
</script>

<style scoped>
.widget-diagram {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  overflow-x: auto;
}
</style>
