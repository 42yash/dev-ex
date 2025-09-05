<template>
  <div class="markdown-widget" v-html="renderedMarkdown"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

const renderedMarkdown = computed(() => {
  if (props.widget.data && props.widget.data.content) {
    return marked(props.widget.data.content);
  }
  return '';
});
</script>

<style scoped>
.markdown-widget {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  line-height: 1.6;
}

.markdown-widget :deep(h1),
.markdown-widget :deep(h2),
.markdown-widget :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-widget :deep(p) {
  margin-bottom: 1em;
}

.markdown-widget :deep(ul),
.markdown-widget :deep(ol) {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.markdown-widget :deep(pre) {
  background: #f0f0f0;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
}

.markdown-widget :deep(code) {
  font-family: 'Courier New', Courier, monospace;
}
</style>
