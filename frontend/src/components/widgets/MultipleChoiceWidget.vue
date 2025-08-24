<template>
  <div class="multiple-choice-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="options-container" :class="{ 'multiple-selection': widget.allowMultiple }">
      <div
        v-for="option in widget.options"
        :key="option.value"
        class="option-item"
        :class="{ 
          'selected': isSelected(option.value),
          'disabled': widget.disabled
        }"
        @click="handleOptionClick(option.value)"
      >
        <div class="option-selector">
          <input
            v-if="widget.allowMultiple"
            type="checkbox"
            :checked="isSelected(option.value)"
            :disabled="widget.disabled"
            @click.stop
            @change="handleOptionClick(option.value)"
          />
          <input
            v-else
            type="radio"
            :name="`multiple-choice-${widget.id}`"
            :checked="isSelected(option.value)"
            :disabled="widget.disabled"
            @click.stop
            @change="handleOptionClick(option.value)"
          />
        </div>
        
        <div class="option-content">
          <div class="option-label">
            <span v-if="option.icon" class="option-icon">{{ option.icon }}</span>
            {{ option.label }}
          </div>
          <div v-if="option.description" class="option-description">
            {{ option.description }}
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="widget.required && !hasSelection" class="widget-error">
      Please select an option
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MultipleChoiceWidget, WidgetEvent } from '@/types/widget';

interface Props {
  widget: MultipleChoiceWidget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  change: [event: WidgetEvent];
}>();

const selectedValues = ref<string[]>([]);

// Initialize selected values
if (props.widget.value) {
  selectedValues.value = [props.widget.value];
} else if (props.widget.allowMultiple && props.widget.value) {
  selectedValues.value = Array.isArray(props.widget.value) 
    ? props.widget.value 
    : [props.widget.value];
}

const hasSelection = computed(() => selectedValues.value.length > 0);

const isSelected = (value: string) => {
  return selectedValues.value.includes(value);
};

const handleOptionClick = (value: string) => {
  if (props.widget.disabled) return;
  
  if (props.widget.allowMultiple) {
    const index = selectedValues.value.indexOf(value);
    if (index > -1) {
      selectedValues.value.splice(index, 1);
    } else {
      selectedValues.value.push(value);
    }
  } else {
    selectedValues.value = [value];
  }
  
  emitChange();
};

const emitChange = () => {
  const value = props.widget.allowMultiple 
    ? selectedValues.value 
    : selectedValues.value[0] || null;
    
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'change',
    value,
    metadata: {
      multiple: props.widget.allowMultiple,
      optionCount: props.widget.options.length
    }
  };
  
  emit('change', event);
};

// Watch for external changes to widget value
watch(() => props.widget.value, (newValue) => {
  if (newValue !== undefined) {
    selectedValues.value = Array.isArray(newValue) ? newValue : [newValue];
  }
});
</script>

<style scoped lang="scss">
.multiple-choice-widget {
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
  
  .options-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .option-item {
    display: flex;
    align-items: flex-start;
    padding: 1rem;
    background: var(--color-background);
    border: 2px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover:not(.disabled) {
      border-color: var(--color-primary);
      background: var(--color-background-mute);
    }
    
    &.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
    }
    
    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  .option-selector {
    margin-right: 0.75rem;
    margin-top: 0.125rem;
    
    input[type="radio"],
    input[type="checkbox"] {
      width: 1.25rem;
      height: 1.25rem;
      cursor: pointer;
      
      &:disabled {
        cursor: not-allowed;
      }
    }
  }
  
  .option-content {
    flex: 1;
  }
  
  .option-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
  }
  
  .option-icon {
    font-size: 1.25rem;
  }
  
  .option-description {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
  
  .widget-error {
    margin-top: 0.5rem;
    color: var(--color-danger);
    font-size: 0.875rem;
  }
}

@media (max-width: 768px) {
  .multiple-choice-widget {
    padding: 0.75rem;
    
    .option-item {
      padding: 0.75rem;
    }
  }
}
</style>