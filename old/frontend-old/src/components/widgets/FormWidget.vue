<template>
  <div class="widget-form">
    <form @submit.prevent="handleSubmit">
      <div v-for="field in widget.data.fields" :key="field.name" class="form-field">
        <label :for="field.name">{{ field.label }}</label>
        
        <input 
          v-if="field.type === 'text' || field.type === 'email' || field.type === 'number'"
          :id="field.name"
          :type="field.type"
          v-model="formData[field.name]"
          :placeholder="field.placeholder"
          :required="field.required"
          class="form-input"
        />
        
        <textarea 
          v-else-if="field.type === 'textarea'"
          :id="field.name"
          v-model="formData[field.name]"
          :placeholder="field.placeholder"
          :required="field.required"
          :rows="field.rows || 4"
          class="form-textarea"
        />
        
        <select 
          v-else-if="field.type === 'select'"
          :id="field.name"
          v-model="formData[field.name]"
          :required="field.required"
          class="form-select"
        >
          <option value="">{{ field.placeholder || 'Select an option' }}</option>
          <option 
            v-for="option in field.options" 
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        
        <div v-else-if="field.type === 'checkbox'" class="form-checkbox">
          <input 
            :id="field.name"
            type="checkbox"
            v-model="formData[field.name]"
          />
          <label :for="field.name">{{ field.label }}</label>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn-primary">
          {{ widget.data.submitLabel || 'Submit' }}
        </button>
        <button type="button" @click="handleCancel" class="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
    <div v-if="message" :class="['form-feedback', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

const emit = defineEmits<{
  (e: 'interact', widget: any, interaction: any): void;
  (e: 'update', widget: any, update: any): void;
}>();

const formData = ref<Record<string, any>>({});
const message = ref('');
const messageType = ref<'success' | 'error' | 'info'>('info');

onMounted(() => {
  if (props.widget.data.fields) {
    props.widget.data.fields.forEach((field: any) => {
      formData.value[field.name] = field.defaultValue || '';
    });
  }
});

function handleSubmit() {
  emit('interact', props.widget, {
    action: 'submit',
    data: formData.value,
  });
}

function handleCancel() {
  emit('interact', props.widget, {
    action: 'cancel',
  });
}

watch(() => props.widget.data.message, (newMessage) => {
  if (newMessage !== undefined) {
    message.value = newMessage;
    messageType.value = props.widget.data.success ? 'success' : 'error';
  }
});
</script>

<style scoped>
.widget-form {
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.form-field {
  margin-bottom: 1.25rem;
}

.form-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.625rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--text-tertiary);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-checkbox input[type="checkbox"] {
  width: 1.125rem;
  height: 1.125rem;
  cursor: pointer;
}

.form-checkbox label {
  margin: 0;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.form-actions button {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.form-feedback {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  font-size: 0.875rem;
}

.form-feedback.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.form-feedback.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.form-feedback.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}
</style>
