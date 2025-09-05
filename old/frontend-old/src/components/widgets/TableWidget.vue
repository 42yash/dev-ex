<template>
  <div class="widget-table">
    <table>
      <thead v-if="widget.data.headers">
        <tr>
          <th v-for="header in widget.data.headers" :key="header">
            {{ header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in widget.data.rows" :key="index">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex">
            {{ cell }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { Widget } from './WidgetManager.vue';

defineProps<{
  widget: Widget;
}>();
</script>

<style scoped>
.widget-table {
  overflow-x: auto;
}

.widget-table table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  overflow: hidden;
}

.widget-table th,
.widget-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.widget-table th {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-primary);
}

.widget-table tr:last-child td {
  border-bottom: none;
}

.widget-table tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
</style>
