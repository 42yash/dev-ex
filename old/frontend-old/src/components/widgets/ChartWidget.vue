<template>
  <div class="widget-chart">
    <canvas :id="`chart-${widget.id}`"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Chart, registerables } from 'chart.js';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

async function initializeChart() {
  try {
    Chart.register(...registerables);
    
    const canvas = document.getElementById(`chart-${props.widget.id}`) as HTMLCanvasElement;
    if (canvas) {
      new Chart(canvas, {
        type: props.widget.data.chartType || 'bar',
        data: props.widget.data.data || {},
        options: props.widget.data.options || {},
      });
    }
  } catch (error) {
    console.error('Failed to load Chart.js:', error);
  }
}

onMounted(() => {
  initializeChart();
});
</script>

<style scoped>
.widget-chart {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.widget-chart canvas {
  max-width: 100%;
  height: auto;
}
</style>
