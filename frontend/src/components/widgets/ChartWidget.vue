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
import { Chart, registerables } from 'chart.js';
import type { ChartWidget } from '@/types/widget';

// Register Chart.js components
Chart.register(...registerables);

interface Props {
  widget: ChartWidget;
}

const props = defineProps<Props>();
const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: Chart | null = null;

// Render chart using Chart.js
const renderChart = () => {
  if (!chartCanvas.value) return;
  
  // Destroy existing chart instance
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  // Create new chart configuration
  const chartConfig: any = {
    type: props.widget.chartType || 'bar',
    data: {
      labels: props.widget.data.labels,
      datasets: props.widget.data.datasets.map(dataset => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(147, 51, 234, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(250, 204, 21, 0.8)'
        ],
        borderColor: dataset.borderColor || [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(251, 146, 60, 1)',
          'rgba(147, 51, 234, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(250, 204, 21, 1)'
        ],
        borderWidth: dataset.borderWidth || 1
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: props.widget.options?.showLegend !== false,
          position: props.widget.options?.legendPosition || 'top'
        },
        title: {
          display: !!props.widget.options?.chartTitle,
          text: props.widget.options?.chartTitle
        },
        tooltip: {
          enabled: props.widget.options?.showTooltip !== false
        }
      },
      scales: props.widget.chartType !== 'pie' && props.widget.chartType !== 'doughnut' ? {
        y: {
          beginAtZero: true,
          grid: {
            display: props.widget.options?.showGrid !== false
          }
        },
        x: {
          grid: {
            display: props.widget.options?.showGrid !== false
          }
        }
      } : undefined,
      ...props.widget.options
    }
  };
  
  // Create new chart instance
  chartInstance = new Chart(chartCanvas.value, chartConfig);
};

onMounted(() => {
  renderChart();
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});

watch(() => props.widget.data, () => {
  renderChart();
}, { deep: true });

watch(() => props.widget.chartType, () => {
  renderChart();
});

watch(() => props.widget.options, () => {
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