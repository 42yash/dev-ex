<template>
  <div class="text-input-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="input-container">
      <textarea
        v-if="widget.multiline"
        v-model="inputValue"
        :placeholder="widget.placeholder"
        :disabled="widget.disabled"
        :maxlength="widget.maxLength"
        :rows="4"
        @input="handleInput"
        class="text-input multiline"
      />
      <input
        v-else
        v-model="inputValue"
        :type="widget.inputType || 'text'"
        :placeholder="widget.placeholder"
        :disabled="widget.disabled"
        :maxlength="widget.maxLength"
        :pattern="widget.pattern"
        @input="handleInput"
        class="text-input"
      />
      
      <div v-if="characterCount" class="character-count">
        {{ inputValue.length }}{{ widget.maxLength ? ` / ${widget.maxLength}` : '' }}
      </div>
    </div>
    
    <div v-if="validationError" class="widget-error">
      {{ validationError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { TextInputWidget, WidgetEvent } from '@/types/widget';

interface Props {
  widget: TextInputWidget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  change: [event: WidgetEvent];
}>();

const inputValue = ref(props.widget.value || '');

const characterCount = computed(() => {
  return props.widget.multiline && (props.widget.maxLength || inputValue.value.length > 50);
});

const validationError = computed(() => {
  if (props.widget.required && !inputValue.value) {
    return 'This field is required';
  }
  
  if (props.widget.minLength && inputValue.value.length < props.widget.minLength) {
    return `Minimum ${props.widget.minLength} characters required`;
  }
  
  if (props.widget.pattern && inputValue.value) {
    const regex = new RegExp(props.widget.pattern);
    if (!regex.test(inputValue.value)) {
      return 'Invalid format';
    }
  }
  
  return '';
});

const handleInput = () => {
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'change',
    value: inputValue.value,
    metadata: {
      isValid: !validationError.value,
      length: inputValue.value.length
    }
  };
  
  emit('change', event);
};

watch(() => props.widget.value, (newValue) => {
  if (newValue !== undefined) {
    inputValue.value = newValue;
  }
});
</script>

<style scoped lang="scss">
.text-input-widget {
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
  
  .input-container {
    position: relative;
  }
  
  .text-input {
    width: 100%;
    padding: 0.75rem;
    font-size: 1rem;
    border: 2px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background);
    color: var(--color-text);
    transition: all 0.2s ease;
    
    &:focus {
      outline: none;
      border-color: var(--color-primary);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    &.multiline {
      resize: vertical;
      min-height: 100px;
      font-family: inherit;
    }
  }
  
  .character-count {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: var(--color-background);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }
  
  .widget-error {
    margin-top: 0.5rem;
    color: var(--color-danger);
    font-size: 0.875rem;
  }
}
</style>