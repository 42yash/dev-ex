<template>
  <div class="workflow-view">
    <WorkflowDashboard />
  </div>
</template>

<script setup lang="ts">
import WorkflowDashboard from '@/components/WorkflowDashboard.vue'
</script>

<style scoped>
.workflow-view {
  @apply min-h-screen bg-gray-50 dark:bg-gray-900;
}
</style>