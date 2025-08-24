/**
 * Widget Type Definitions for Dev-Ex Platform
 */

export enum WidgetType {
  MULTIPLE_CHOICE = 'multiple_choice',
  CHECKBOX = 'checkbox',
  TEXT_INPUT = 'text_input',
  SLIDER = 'slider',
  PROGRESS = 'progress',
  CHART = 'chart',
  TABLE = 'table',
  CODE_EDITOR = 'code_editor',
  DIAGRAM = 'diagram',
  FILE_UPLOAD = 'file_upload',
  DATE_PICKER = 'date_picker',
  NOTIFICATION = 'notification'
}

export interface BaseWidget {
  id: string;
  type: WidgetType;
  title?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  visible?: boolean;
  metadata?: Record<string, any>;
}

export interface MultipleChoiceWidget extends BaseWidget {
  type: WidgetType.MULTIPLE_CHOICE;
  options: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: string;
  }>;
  value?: string;
  allowMultiple?: boolean;
}

export interface CheckboxWidget extends BaseWidget {
  type: WidgetType.CHECKBOX;
  options: Array<{
    value: string;
    label: string;
    description?: string;
    checked?: boolean;
  }>;
  values?: string[];
  minSelection?: number;
  maxSelection?: number;
}

export interface TextInputWidget extends BaseWidget {
  type: WidgetType.TEXT_INPUT;
  placeholder?: string;
  value?: string;
  multiline?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  inputType?: 'text' | 'email' | 'url' | 'number' | 'password';
}

export interface SliderWidget extends BaseWidget {
  type: WidgetType.SLIDER;
  min: number;
  max: number;
  step?: number;
  value?: number;
  unit?: string;
  showValue?: boolean;
  marks?: Array<{
    value: number;
    label: string;
  }>;
}

export interface ProgressWidget extends BaseWidget {
  type: WidgetType.PROGRESS;
  value: number;
  max?: number;
  status?: 'active' | 'success' | 'error' | 'warning';
  showPercentage?: boolean;
  steps?: Array<{
    label: string;
    completed: boolean;
    current?: boolean;
  }>;
}

export interface ChartWidget extends BaseWidget {
  type: WidgetType.CHART;
  chartType: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
    }>;
  };
  options?: Record<string, any>;
}

export interface TableWidget extends BaseWidget {
  type: WidgetType.TABLE;
  columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
  }>;
  rows: Array<Record<string, any>>;
  selectable?: boolean;
  pagination?: {
    enabled: boolean;
    pageSize: number;
    currentPage: number;
  };
}

export interface CodeEditorWidget extends BaseWidget {
  type: WidgetType.CODE_EDITOR;
  language: string;
  value?: string;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  height?: string;
  showLineNumbers?: boolean;
  wordWrap?: boolean;
}

export interface DiagramWidget extends BaseWidget {
  type: WidgetType.DIAGRAM;
  diagramType: 'flowchart' | 'sequence' | 'class' | 'state' | 'gantt';
  content: string;
  renderer?: 'mermaid' | 'plantuml' | 'd2';
}

export interface FileUploadWidget extends BaseWidget {
  type: WidgetType.FILE_UPLOAD;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  files?: File[];
}

export interface DatePickerWidget extends BaseWidget {
  type: WidgetType.DATE_PICKER;
  value?: string;
  min?: string;
  max?: string;
  format?: string;
  showTime?: boolean;
  disabledDates?: string[];
}

export interface NotificationWidget extends BaseWidget {
  type: WidgetType.NOTIFICATION;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  closable?: boolean;
  duration?: number;
  action?: {
    label: string;
    handler: string;
  };
}

export type Widget = 
  | MultipleChoiceWidget
  | CheckboxWidget
  | TextInputWidget
  | SliderWidget
  | ProgressWidget
  | ChartWidget
  | TableWidget
  | CodeEditorWidget
  | DiagramWidget
  | FileUploadWidget
  | DatePickerWidget
  | NotificationWidget;

export interface WidgetEvent {
  widgetId: string;
  type: 'change' | 'click' | 'submit' | 'cancel' | 'custom';
  value?: any;
  metadata?: Record<string, any>;
}

export interface WidgetValidation {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface WidgetGroup {
  id: string;
  title?: string;
  description?: string;
  widgets: Widget[];
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
}

export interface WidgetResponse {
  widgets: Widget[];
  groups?: WidgetGroup[];
  layout?: 'single' | 'grouped' | 'tabbed';
  submitButton?: {
    label: string;
    disabled?: boolean;
  };
  cancelButton?: {
    label: string;
    visible?: boolean;
  };
}