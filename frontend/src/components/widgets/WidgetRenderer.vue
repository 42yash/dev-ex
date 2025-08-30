<template>
  <div class="widget-renderer">
    <component
      :is="getWidgetComponent(widget.type)"
      :widget="widget"
      @change="handleWidgetChange"
      @action="handleWidgetAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Widget, WidgetEvent } from '@/types/widget';
import { WidgetType } from '@/types/widget';

// Import widget components
import MultipleChoiceWidget from './MultipleChoiceWidget.vue';
import CheckboxWidget from './CheckboxWidget.vue';
import ProgressWidget from './ProgressWidget.vue';
import TextInputWidget from './TextInputWidget.vue';
import SliderWidget from './SliderWidget.vue';
import ChartWidget from './ChartWidget.vue';
import TableWidget from './TableWidget.vue';
import DiagramWidget from './DiagramWidget.vue';
import NotificationWidget from './NotificationWidget.vue';
import CodeEditorWidget from './CodeEditorWidget.vue';
import FileUploadWidget from './FileUploadWidget.vue';

interface Props {
  widget: Widget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  change: [event: WidgetEvent];
  action: [event: WidgetEvent];
}>();

const widgetComponents = {
  [WidgetType.MULTIPLE_CHOICE]: MultipleChoiceWidget,
  [WidgetType.CHECKBOX]: CheckboxWidget,
  [WidgetType.PROGRESS]: ProgressWidget,
  [WidgetType.TEXT_INPUT]: TextInputWidget,
  [WidgetType.SLIDER]: SliderWidget,
  [WidgetType.CHART]: ChartWidget,
  [WidgetType.TABLE]: TableWidget,
  [WidgetType.CODE_EDITOR]: CodeEditorWidget,
  [WidgetType.DIAGRAM]: DiagramWidget,
  [WidgetType.NOTIFICATION]: NotificationWidget,
  [WidgetType.FILE_UPLOAD]: FileUploadWidget,
};

const getWidgetComponent = (type: WidgetType) => {
  return widgetComponents[type] || null;
};

const handleWidgetChange = (event: WidgetEvent) => {
  emit('change', event);
};

const handleWidgetAction = (event: WidgetEvent) => {
  emit('action', event);
};
</script>

<style scoped lang="scss">
.widget-renderer {
  width: 100%;
  margin: 0.5rem 0;
}
</style>