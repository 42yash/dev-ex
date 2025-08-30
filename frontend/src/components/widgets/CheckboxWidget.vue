<template>
  <div class="checkbox-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="checkboxes-container">
      <label
        v-for="option in widget.options"
        :key="option.value"
        class="checkbox-item"
        :class="{ 'disabled': widget.disabled }"
      >
        <input
          type="checkbox"
          :checked="isChecked(option.value)"
          :disabled="widget.disabled || !canToggle(option.value)"
          @change="handleCheckboxChange(option.value)"
        />
        <div class="checkbox-content">
          <span class="checkbox-label">{{ option.label }}</span>
          <span v-if="option.description" class="checkbox-description">
            {{ option.description }}
          </span>
        </div>
      </label>
    </div>
    
    <div v-if="validationMessage" class="widget-validation">
      {{ validationMessage }}
    </div>
    
    <div v-if="selectionInfo" class="selection-info">
      {{ selectionInfo }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { CheckboxWidget, WidgetEvent } from '@/types/widget';

interface Props {
  widget: CheckboxWidget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  change: [event: WidgetEvent];
}>();

const selectedValues = ref<string[]>([]);

// Initialize selected values
if (props.widget.values) {
  selectedValues.value = [...props.widget.values];
} else {
  // Check for pre-checked options
  const preChecked = props.widget.options
    .filter(opt => opt.checked)
    .map(opt => opt.value);
  selectedValues.value = preChecked;
}

const validationMessage = computed(() => {
  const count = selectedValues.value.length;
  
  if (props.widget.required && count === 0) {
    return 'Please select at least one option';
  }
  
  if (props.widget.minSelection && count < props.widget.minSelection) {
    return `Please select at least ${props.widget.minSelection} option${props.widget.minSelection > 1 ? 's' : ''}`;
  }
  
  if (props.widget.maxSelection && count > props.widget.maxSelection) {
    return `Please select no more than ${props.widget.maxSelection} option${props.widget.maxSelection > 1 ? 's' : ''}`;
  }
  
  return '';
});

const selectionInfo = computed(() => {
  const count = selectedValues.value.length;
  const parts = [];
  
  if (count > 0) {
    parts.push(`${count} selected`);
  }
  
  if (props.widget.minSelection || props.widget.maxSelection) {
    if (props.widget.minSelection && props.widget.maxSelection) {
      parts.push(`(${props.widget.minSelection}-${props.widget.maxSelection} required)`);
    } else if (props.widget.minSelection) {
      parts.push(`(min ${props.widget.minSelection})`);
    } else if (props.widget.maxSelection) {
      parts.push(`(max ${props.widget.maxSelection})`);
    }
  }
  
  return parts.join(' ');
});

const isChecked = (value: string) => {
  return selectedValues.value.includes(value);
};

const canToggle = (value: string) => {
  if (isChecked(value)) {
    // Can uncheck if not below minimum
    return !props.widget.minSelection || selectedValues.value.length > props.widget.minSelection;
  } else {
    // Can check if not above maximum
    return !props.widget.maxSelection || selectedValues.value.length < props.widget.maxSelection;
  }
};

const handleCheckboxChange = (value: string) => {
  if (props.widget.disabled) return;
  
  const index = selectedValues.value.indexOf(value);
  
  if (index > -1) {
    // Uncheck
    if (canToggle(value)) {
      selectedValues.value.splice(index, 1);
    }
  } else {
    // Check
    if (canToggle(value)) {
      selectedValues.value.push(value);
    }
  }
  
  emitChange();
};

const emitChange = () => {
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'change',
    value: selectedValues.value,
    metadata: {
      count: selectedValues.value.length,
      isValid: !validationMessage.value
    }
  };
  
  emit('change', event);
};

// Watch for external changes to widget values
watch(() => props.widget.values, (newValues) => {
  if (newValues) {
    selectedValues.value = [...newValues];
  }
});
</script>

<style scoped lang="scss">
.checkbox-widget {
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
  
  .checkboxes-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .checkbox-item {
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    padding: 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    transition: all 0.2s ease;
    
    &:hover:not(.disabled) {
      background: var(--color-background-mute);
      border-color: var(--color-primary);
    }
    
    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    input[type="checkbox"] {
      width: 1.25rem;
      height: 1.25rem;
      margin-right: 0.75rem;
      margin-top: 0.125rem;
      cursor: pointer;
      flex-shrink: 0;
      
      &:disabled {
        cursor: not-allowed;
      }
    }
  }
  
  .checkbox-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .checkbox-label {
    font-weight: 500;
    color: var(--color-text);
  }
  
  .checkbox-description {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
  
  .widget-validation {
    margin-top: 0.5rem;
    color: var(--color-danger);
    font-size: 0.875rem;
  }
  
  .selection-info {
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: var(--color-background-mute);
    border-radius: 4px;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    text-align: center;
  }
}

@media (max-width: 768px) {
  .checkbox-widget {
    padding: 0.75rem;
    
    .checkbox-item {
      padding: 0.5rem;
    }
  }
}
</style>