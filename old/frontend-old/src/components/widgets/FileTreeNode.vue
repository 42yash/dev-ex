<template>
  <div class="file-tree-node">
    <div @click="toggle" :class="{ 'is-folder': isFolder }">
      {{ node.name }}
    </div>
    <div v-if="isFolder && isOpen" class="children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.name"
        :node="child"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  node: any;
}>();

const isOpen = ref(false);

const isFolder = computed(() => {
  return props.node.children && props.node.children.length > 0;
});

function toggle() {
  if (isFolder.value) {
    isOpen.value = !isOpen.value;
  }
}
</script>

<style scoped>
.file-tree-node {
  margin-left: 1em;
}

.is-folder {
  cursor: pointer;
  font-weight: bold;
}

.children {
  margin-left: 1em;
}
</style>
