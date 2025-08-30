import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Widget, WidgetEvent, WidgetGroup, WidgetResponse, WidgetValidation } from '@/types/widget';

export const useWidgetStore = defineStore('widgets', () => {
  // State
  const widgets = ref<Map<string, Widget>>(new Map());
  const widgetGroups = ref<WidgetGroup[]>([]);
  const widgetValues = ref<Map<string, any>>(new Map());
  const widgetValidations = ref<Map<string, WidgetValidation>>(new Map());
  const activeWidgets = ref<Set<string>>(new Set());
  
  // Computed
  const allWidgets = computed(() => Array.from(widgets.value.values()));
  
  const visibleWidgets = computed(() => 
    allWidgets.value.filter(w => w.visible !== false)
  );
  
  const requiredWidgets = computed(() => 
    allWidgets.value.filter(w => w.required)
  );
  
  const isFormValid = computed(() => {
    for (const widget of requiredWidgets.value) {
      const validation = widgetValidations.value.get(widget.id);
      if (!validation?.isValid) return false;
      
      const value = widgetValues.value.get(widget.id);
      if (widget.required && !value) return false;
    }
    return true;
  });
  
  const formData = computed(() => {
    const data: Record<string, any> = {};
    widgetValues.value.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  });
  
  // Actions
  const addWidget = (widget: Widget) => {
    widgets.value.set(widget.id, widget);
    activeWidgets.value.add(widget.id);
    
    // Set initial value if provided
    if ('value' in widget && widget.value !== undefined) {
      widgetValues.value.set(widget.id, widget.value);
    } else if ('values' in widget && widget.values !== undefined) {
      widgetValues.value.set(widget.id, widget.values);
    }
  };
  
  const addWidgets = (widgetList: Widget[]) => {
    widgetList.forEach(widget => addWidget(widget));
  };
  
  const removeWidget = (widgetId: string) => {
    widgets.value.delete(widgetId);
    widgetValues.value.delete(widgetId);
    widgetValidations.value.delete(widgetId);
    activeWidgets.value.delete(widgetId);
  };
  
  const clearWidgets = () => {
    widgets.value.clear();
    widgetValues.value.clear();
    widgetValidations.value.clear();
    activeWidgets.value.clear();
    widgetGroups.value = [];
  };
  
  const updateWidgetValue = (widgetId: string, value: any) => {
    widgetValues.value.set(widgetId, value);
    
    // Update the widget itself if it has a value property
    const widget = widgets.value.get(widgetId);
    if (widget) {
      if ('value' in widget) {
        (widget as any).value = value;
      } else if ('values' in widget) {
        (widget as any).values = value;
      }
    }
  };
  
  const updateWidgetValidation = (widgetId: string, validation: WidgetValidation) => {
    widgetValidations.value.set(widgetId, validation);
  };
  
  const handleWidgetEvent = (event: WidgetEvent) => {
    switch (event.type) {
      case 'change':
        updateWidgetValue(event.widgetId, event.value);
        
        // Auto-validate if metadata includes validation
        if (event.metadata?.isValid !== undefined) {
          updateWidgetValidation(event.widgetId, {
            isValid: event.metadata.isValid,
            errors: event.metadata.errors
          });
        }
        break;
        
      case 'submit':
        // Handle form submission
        if (isFormValid.value) {
          console.log('Form submitted:', formData.value);
        }
        break;
        
      case 'cancel':
        // Handle cancellation
        clearWidgets();
        break;
    }
  };
  
  const setWidgetGroups = (groups: WidgetGroup[]) => {
    widgetGroups.value = groups;
    
    // Add all widgets from groups
    groups.forEach(group => {
      group.widgets.forEach(widget => addWidget(widget));
    });
  };
  
  const loadWidgetResponse = (response: WidgetResponse) => {
    clearWidgets();
    
    if (response.groups) {
      setWidgetGroups(response.groups);
    } else if (response.widgets) {
      addWidgets(response.widgets);
    }
  };
  
  const getWidgetValue = (widgetId: string) => {
    return widgetValues.value.get(widgetId);
  };
  
  const getWidget = (widgetId: string) => {
    return widgets.value.get(widgetId);
  };
  
  const validateWidget = (widgetId: string): WidgetValidation => {
    const widget = widgets.value.get(widgetId);
    const value = widgetValues.value.get(widgetId);
    
    if (!widget) {
      return { isValid: false, errors: ['Widget not found'] };
    }
    
    const errors: string[] = [];
    
    // Check required
    if (widget.required && !value) {
      errors.push('This field is required');
    }
    
    // Type-specific validation
    if ('minLength' in widget && value?.length < widget.minLength) {
      errors.push(`Minimum length is ${widget.minLength}`);
    }
    
    if ('maxLength' in widget && value?.length > widget.maxLength) {
      errors.push(`Maximum length is ${widget.maxLength}`);
    }
    
    if ('pattern' in widget && widget.pattern && value) {
      const regex = new RegExp(widget.pattern);
      if (!regex.test(value)) {
        errors.push('Invalid format');
      }
    }
    
    if ('minSelection' in widget && value?.length < widget.minSelection) {
      errors.push(`Select at least ${widget.minSelection} options`);
    }
    
    if ('maxSelection' in widget && value?.length > widget.maxSelection) {
      errors.push(`Select at most ${widget.maxSelection} options`);
    }
    
    const validation: WidgetValidation = {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
    
    updateWidgetValidation(widgetId, validation);
    return validation;
  };
  
  const validateAllWidgets = (): boolean => {
    let allValid = true;
    
    for (const widget of allWidgets.value) {
      const validation = validateWidget(widget.id);
      if (!validation.isValid) {
        allValid = false;
      }
    }
    
    return allValid;
  };
  
  return {
    // State
    widgets,
    widgetGroups,
    widgetValues,
    widgetValidations,
    activeWidgets,
    
    // Computed
    allWidgets,
    visibleWidgets,
    requiredWidgets,
    isFormValid,
    formData,
    
    // Actions
    addWidget,
    addWidgets,
    removeWidget,
    clearWidgets,
    updateWidgetValue,
    updateWidgetValidation,
    handleWidgetEvent,
    setWidgetGroups,
    loadWidgetResponse,
    getWidgetValue,
    getWidget,
    validateWidget,
    validateAllWidgets
  };
});