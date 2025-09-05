<template>
  <div class="file-tree-widget">
    <div v-if="rootNode">
      <FileTreeNode :node="rootNode" />
    </div>
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    <div v-else>
      Loading file tree...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import FileTreeNode from './FileTreeNode.vue';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

const emit = defineEmits<{
  (e: 'interact', widget: any, interaction: any): void;
  (e: 'update', widget: any, update: any): void;
}>();

const rootNode = ref(props.widget.data.root || null);
const error = ref(props.widget.data.error || null);

onMounted(() => {
  if (!rootNode.value && !error.value) {
    emit('interact', props.widget, {
      action: 'request',
      path: props.widget.data.path || '.',
    });
  }
});

watch(() => props.widget.data.root, (newRoot) => {
  if (newRoot !== undefined) {
    rootNode.value = newRoot;
  }
});

watch(() => props.widget.data.error, (newError) => {
  if (newError !== undefined) {
    error.value = newError;
  }
});
</script>

<style scoped>
.file-tree-widget {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.error-message {
  color: red;
}
</style>
