<template>
  <div class="progress-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <!-- Linear Progress Bar -->
    <div v-if="!widget.steps" class="progress-bar-container">
      <div class="progress-bar" :class="`status-${widget.status || 'active'}`">
        <div 
          class="progress-fill"
          :style="{ width: progressPercentage + '%' }"
        >
          <span v-if="widget.showPercentage !== false" class="progress-text">
            {{ progressPercentage }}%
          </span>
        </div>
      </div>
      <div v-if="progressLabel" class="progress-label">
        {{ progressLabel }}
      </div>
    </div>
    
    <!-- Step Progress -->
    <div v-else class="progress-steps">
      <div
        v-for="(step, index) in widget.steps"
        :key="index"
        class="step-item"
        :class="{
          'completed': step.completed,
          'current': step.current,
          'pending': !step.completed && !step.current
        }"
      >
        <div class="step-connector" v-if="index > 0"></div>
        <div class="step-marker">
          <div class="step-circle">
            <span v-if="step.completed" class="step-icon">✓</span>
            <span v-else-if="step.current" class="step-icon">●</span>
            <span v-else class="step-number">{{ index + 1 }}</span>
          </div>
        </div>
        <div class="step-content">
          <div class="step-label">{{ step.label }}</div>
        </div>
      </div>
    </div>
    
    <!-- Circular Progress (Alternative View) -->
    <div v-if="showCircular" class="circular-progress">
      <svg class="circular-svg" viewBox="0 0 100 100">
        <circle
          class="circular-bg"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke-width="8"
        />
        <circle
          class="circular-fill"
          :class="`status-${widget.status || 'active'}`"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke-width="8"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="strokeDashoffset"
        />
      </svg>
      <div class="circular-text">
        <span class="percentage">{{ progressPercentage }}%</span>
        <span v-if="widget.status" class="status-text">{{ statusText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ProgressWidget } from '@/types/widget';

interface Props {
  widget: ProgressWidget;
  showCircular?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showCircular: false
});

const progressPercentage = computed(() => {
  if (props.widget.steps) {
    const completed = props.widget.steps.filter(s => s.completed).length;
    return Math.round((completed / props.widget.steps.length) * 100);
  }
  
  const max = props.widget.max || 100;
  return Math.min(100, Math.round((props.widget.value / max) * 100));
});

const progressLabel = computed(() => {
  if (props.widget.max && props.widget.max !== 100) {
    return `${props.widget.value} / ${props.widget.max}`;
  }
  return '';
});

const statusText = computed(() => {
  const statusMap = {
    active: 'In Progress',
    success: 'Complete',
    error: 'Failed',
    warning: 'Warning'
  };
  return statusMap[props.widget.status as keyof typeof statusMap] || '';
});

// Circular progress calculations
const circumference = 2 * Math.PI * 45;
const strokeDashoffset = computed(() => {
  return circumference - (progressPercentage.value / 100) * circumference;
});
</script>

<style scoped lang="scss">
.progress-widget {
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
  
  // Linear Progress Bar
  .progress-bar-container {
    margin: 1rem 0;
  }
  
  .progress-bar {
    height: 24px;
    background: var(--color-background-mute);
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    
    &.status-active .progress-fill {
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      animation: pulse 2s infinite;
    }
    
    &.status-success .progress-fill {
      background: linear-gradient(90deg, #10b981, #34d399);
    }
    
    &.status-error .progress-fill {
      background: linear-gradient(90deg, #ef4444, #f87171);
    }
    
    &.status-warning .progress-fill {
      background: linear-gradient(90deg, #f59e0b, #fbbf24);
    }
  }
  
  .progress-fill {
    height: 100%;
    transition: width 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  .progress-text {
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .progress-label {
    margin-top: 0.5rem;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }
  
  // Step Progress
  .progress-steps {
    display: flex;
    flex-direction: column;
    position: relative;
    padding-left: 2rem;
  }
  
  .step-item {
    display: flex;
    align-items: flex-start;
    position: relative;
    min-height: 60px;
    
    &:not(:last-child) .step-connector {
      position: absolute;
      left: -1.625rem;
      top: 28px;
      width: 2px;
      height: calc(100% - 4px);
      background: var(--color-border);
    }
    
    &.completed {
      .step-connector {
        background: var(--color-success);
      }
      
      .step-circle {
        background: var(--color-success);
        color: white;
      }
      
      .step-label {
        color: var(--color-text);
      }
    }
    
    &.current {
      .step-circle {
        background: var(--color-primary);
        color: white;
        animation: pulse 2s infinite;
      }
      
      .step-label {
        color: var(--color-primary);
        font-weight: 600;
      }
    }
    
    &.pending {
      .step-circle {
        background: var(--color-background-mute);
        color: var(--color-text-secondary);
      }
      
      .step-label {
        color: var(--color-text-secondary);
      }
    }
  }
  
  .step-marker {
    position: absolute;
    left: -2rem;
  }
  
  .step-circle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  
  .step-content {
    flex: 1;
    padding-left: 1rem;
  }
  
  .step-label {
    line-height: 28px;
    transition: all 0.3s ease;
  }
  
  // Circular Progress
  .circular-progress {
    width: 120px;
    height: 120px;
    margin: 1rem auto;
    position: relative;
  }
  
  .circular-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  
  .circular-bg {
    stroke: var(--color-background-mute);
  }
  
  .circular-fill {
    transition: stroke-dashoffset 0.3s ease;
    
    &.status-active {
      stroke: #3b82f6;
    }
    
    &.status-success {
      stroke: #10b981;
    }
    
    &.status-error {
      stroke: #ef4444;
    }
    
    &.status-warning {
      stroke: #f59e0b;
    }
  }
  
  .circular-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .percentage {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-heading);
  }
  
  .status-text {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }
  
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 1;
    }
  }
}

@media (max-width: 768px) {
  .progress-widget {
    padding: 0.75rem;
  }
}
</style>