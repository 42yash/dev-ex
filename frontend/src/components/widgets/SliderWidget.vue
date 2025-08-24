<template>
  <div class="slider-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="slider-container">
      <input
        type="range"
        v-model.number="sliderValue"
        :min="widget.min"
        :max="widget.max"
        :step="widget.step || 1"
        :disabled="widget.disabled"
        @input="handleSliderChange"
        class="slider"
      />
      
      <div class="slider-labels">
        <span class="min-label">{{ widget.min }}{{ widget.unit || '' }}</span>
        <span v-if="widget.showValue !== false" class="current-value">
          {{ sliderValue }}{{ widget.unit || '' }}
        </span>
        <span class="max-label">{{ widget.max }}{{ widget.unit || '' }}</span>
      </div>
      
      <div v-if="widget.marks" class="slider-marks">
        <div
          v-for="mark in widget.marks"
          :key="mark.value"
          class="mark"
          :style="{ left: getMarkPosition(mark.value) + '%' }"
        >
          <span class="mark-tick"></span>
          <span class="mark-label">{{ mark.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SliderWidget, WidgetEvent } from '@/types/widget';

interface Props {
  widget: SliderWidget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  change: [event: WidgetEvent];
}>();

const sliderValue = ref(props.widget.value || props.widget.min);

const getMarkPosition = (value: number) => {
  return ((value - props.widget.min) / (props.widget.max - props.widget.min)) * 100;
};

const handleSliderChange = () => {
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'change',
    value: sliderValue.value,
    metadata: {
      percentage: getMarkPosition(sliderValue.value)
    }
  };
  
  emit('change', event);
};

watch(() => props.widget.value, (newValue) => {
  if (newValue !== undefined) {
    sliderValue.value = newValue;
  }
});
</script>

<style scoped lang="scss">
.slider-widget {
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
  
  .slider-container {
    padding: 1rem 0;
  }
  
  .slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--color-background-mute);
    outline: none;
    -webkit-appearance: none;
    
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--color-primary);
      cursor: pointer;
      transition: transform 0.2s;
      
      &:hover {
        transform: scale(1.2);
      }
    }
    
    &::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--color-primary);
      cursor: pointer;
      transition: transform 0.2s;
      
      &:hover {
        transform: scale(1.2);
      }
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  .slider-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    
    .current-value {
      font-weight: 600;
      color: var(--color-primary);
    }
  }
  
  .slider-marks {
    position: relative;
    margin-top: 1.5rem;
    height: 30px;
    
    .mark {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translateX(-50%);
      
      .mark-tick {
        width: 2px;
        height: 8px;
        background: var(--color-border);
        margin-bottom: 4px;
      }
      
      .mark-label {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }
    }
  }
}
</style>