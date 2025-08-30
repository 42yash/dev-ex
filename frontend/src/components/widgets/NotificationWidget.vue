<template>
  <transition name="notification">
    <div
      v-if="visible"
      class="notification-widget"
      :class="`severity-${widget.severity}`"
    >
      <div class="notification-icon">
        {{ getIcon() }}
      </div>
      
      <div class="notification-content">
        <div v-if="widget.title" class="notification-title">{{ widget.title }}</div>
        <div class="notification-message">{{ widget.message }}</div>
      </div>
      
      <div class="notification-actions">
        <button
          v-if="widget.action"
          @click="handleAction"
          class="action-button"
        >
          {{ widget.action.label }}
        </button>
        
        <button
          v-if="widget.closable !== false"
          @click="close"
          class="close-button"
        >
          ✕
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { NotificationWidget, WidgetEvent } from '@/types/widget';

interface Props {
  widget: NotificationWidget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  action: [event: WidgetEvent];
}>();

const visible = ref(true);

const getIcon = () => {
  const icons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✕'
  };
  return icons[props.widget.severity];
};

const handleAction = () => {
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'action',
    value: props.widget.action?.handler,
    metadata: {
      action: 'custom'
    }
  };
  emit('action', event);
};

const close = () => {
  visible.value = false;
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'action',
    value: 'close',
    metadata: {
      action: 'close'
    }
  };
  emit('action', event);
};

onMounted(() => {
  if (props.widget.duration) {
    setTimeout(() => {
      close();
    }, props.widget.duration);
  }
});
</script>

<style scoped lang="scss">
.notification-widget {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  &.severity-info {
    background: #e0f2fe;
    border-left: 4px solid #0ea5e9;
    
    .notification-icon {
      color: #0ea5e9;
    }
  }
  
  &.severity-success {
    background: #dcfce7;
    border-left: 4px solid #22c55e;
    
    .notification-icon {
      color: #22c55e;
    }
  }
  
  &.severity-warning {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    
    .notification-icon {
      color: #f59e0b;
    }
  }
  
  &.severity-error {
    background: #fee2e2;
    border-left: 4px solid #ef4444;
    
    .notification-icon {
      color: #ef4444;
    }
  }
  
  .notification-icon {
    font-size: 1.25rem;
    font-weight: bold;
    width: 24px;
    text-align: center;
  }
  
  .notification-content {
    flex: 1;
    
    .notification-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: var(--color-heading);
    }
    
    .notification-message {
      color: var(--color-text);
      line-height: 1.5;
    }
  }
  
  .notification-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    
    .action-button {
      padding: 0.375rem 0.75rem;
      background: transparent;
      border: 1px solid currentColor;
      border-radius: 4px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(0, 0, 0, 0.05);
      }
    }
    
    .close-button {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--color-text-secondary);
      
      &:hover {
        background: rgba(0, 0, 0, 0.1);
      }
    }
  }
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>