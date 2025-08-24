<template>
  <div class="chart-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import type { ChartWidget } from '@/types/widget';

interface Props {
  widget: ChartWidget;
}

const props = defineProps<Props>();
const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: any = null;

// Simple chart rendering (placeholder - would use Chart.js in production)
const renderChart = () => {
  if (!chartCanvas.value) return;
  
  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, chartCanvas.value.width, chartCanvas.value.height);
  
  // Set canvas size
  chartCanvas.value.width = chartCanvas.value.offsetWidth;
  chartCanvas.value.height = 300;
  
  // Simple bar chart rendering as placeholder
  if (props.widget.chartType === 'bar') {
    const data = props.widget.data.datasets[0].data;
    const labels = props.widget.data.labels;
    const maxValue = Math.max(...data);
    const barWidth = chartCanvas.value.width / (data.length * 2);
    const chartHeight = chartCanvas.value.height - 40;
    
    // Draw bars
    data.forEach((value, index) => {
      const barHeight = (value / maxValue) * chartHeight;
      const x = (index * 2 + 0.5) * barWidth;
      const y = chartCanvas.value!.height - barHeight - 20;
      
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw label
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, chartCanvas.value!.height - 5);
    });
  }
  
  // Note: In production, integrate Chart.js for full chart functionality
};

onMounted(() => {
  renderChart();
  window.addEventListener('resize', renderChart);
});

onUnmounted(() => {
  window.removeEventListener('resize', renderChart);
  if (chartInstance) {
    // chartInstance.destroy();
  }
});

watch(() => props.widget.data, () => {
  renderChart();
}, { deep: true });
</script>

<style scoped lang="scss">
.chart-widget {
  padding: 1rem;
  background: var(--color-background-soft);
  border-radius: 8px;
  
  .widget-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--color-heading);
  }
  
  .widget-description {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
  }
  
  .chart-container {
    width: 100%;
    min-height: 300px;
    position: relative;
    
    canvas {
      width: 100% !important;
      height: auto !important;
    }
  }
}
</style>