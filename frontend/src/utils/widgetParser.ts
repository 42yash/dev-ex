/**
 * Widget Parser - Parses AI responses and extracts widget specifications
 */

import type { Widget, WidgetResponse, WidgetType } from '@/types/widget';

// Simple UUID alternative
function generateId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface AIResponseWithWidgets {
  text?: string;
  widgets?: Widget[];
  widgetResponse?: WidgetResponse;
  nextPhase?: string;
  context?: Record<string, any>;
}

/**
 * Parses an AI response and extracts widget specifications
 * AI responses can include widgets in a special JSON structure
 */
export function parseAIResponse(response: string): AIResponseWithWidgets {
  const result: AIResponseWithWidgets = {
    text: response
  };
  
  try {
    // Check if response contains widget JSON
    const widgetMatch = response.match(/\[WIDGETS\](.*?)\[\/WIDGETS\]/s);
    if (widgetMatch) {
      const widgetJson = widgetMatch[1].trim();
      const widgetData = JSON.parse(widgetJson);
      
      // Remove widget JSON from display text
      result.text = response.replace(/\[WIDGETS\].*?\[\/WIDGETS\]/s, '').trim();
      
      // Process widget data
      if (widgetData.widgets) {
        result.widgets = processWidgets(widgetData.widgets);
      }
      
      if (widgetData.widgetResponse) {
        result.widgetResponse = processWidgetResponse(widgetData.widgetResponse);
      }
      
      if (widgetData.nextPhase) {
        result.nextPhase = widgetData.nextPhase;
      }
      
      if (widgetData.context) {
        result.context = widgetData.context;
      }
    }
    
    // Alternative format: Check for inline widget specifications
    const inlineWidgetMatch = response.match(/```widgets\n(.*?)```/s);
    if (inlineWidgetMatch) {
      const widgetJson = inlineWidgetMatch[1].trim();
      const widgets = JSON.parse(widgetJson);
      
      result.text = response.replace(/```widgets\n.*?```/s, '').trim();
      result.widgets = processWidgets(widgets);
    }
  } catch (error) {
    console.error('Error parsing widget response:', error);
    // Return original response if parsing fails
  }
  
  return result;
}

/**
 * Process and validate widgets, adding IDs if missing
 */
function processWidgets(widgets: any[]): Widget[] {
  return widgets.map(widget => {
    // Ensure widget has an ID
    if (!widget.id) {
      widget.id = generateId();
    }
    
    // Validate widget type
    if (!widget.type) {
      console.warn('Widget missing type:', widget);
      return null;
    }
    
    // Set defaults based on widget type
    widget = applyWidgetDefaults(widget);
    
    return widget as Widget;
  }).filter(Boolean) as Widget[];
}

/**
 * Process widget response structure
 */
function processWidgetResponse(response: any): WidgetResponse {
  const processed: WidgetResponse = {
    widgets: [],
    layout: response.layout || 'single'
  };
  
  if (response.widgets) {
    processed.widgets = processWidgets(response.widgets);
  }
  
  if (response.groups) {
    processed.groups = response.groups.map((group: any) => ({
      ...group,
      id: group.id || generateId(),
      widgets: processWidgets(group.widgets || [])
    }));
  }
  
  if (response.submitButton) {
    processed.submitButton = response.submitButton;
  }
  
  if (response.cancelButton) {
    processed.cancelButton = response.cancelButton;
  }
  
  return processed;
}

/**
 * Apply default values based on widget type
 */
function applyWidgetDefaults(widget: any): any {
  const defaults: Record<string, any> = {
    visible: true,
    disabled: false
  };
  
  // Type-specific defaults
  switch (widget.type) {
    case 'progress':
      defaults.max = widget.max || 100;
      defaults.showPercentage = widget.showPercentage !== false;
      break;
      
    case 'multiple_choice':
      defaults.allowMultiple = widget.allowMultiple || false;
      break;
      
    case 'text_input':
      defaults.inputType = widget.inputType || 'text';
      defaults.multiline = widget.multiline || false;
      break;
      
    case 'slider':
      defaults.step = widget.step || 1;
      defaults.showValue = widget.showValue !== false;
      break;
      
    case 'notification':
      defaults.closable = widget.closable !== false;
      defaults.duration = widget.duration || 0;
      break;
      
    case 'table':
      if (widget.pagination) {
        defaults.pagination = {
          enabled: true,
          pageSize: widget.pagination.pageSize || 10,
          currentPage: widget.pagination.currentPage || 1
        };
      }
      break;
  }
  
  return { ...defaults, ...widget };
}

/**
 * Generate sample widgets for testing
 */
export function generateSampleWidgets(): Widget[] {
  return [
    {
      id: generateId(),
      type: 'multiple_choice' as WidgetType,
      title: 'What would you like to build?',
      description: 'Choose the type of application you want to create',
      options: [
        {
          value: 'web',
          label: 'Web Application',
          description: 'Build a modern web app with React or Vue',
          icon: '🌐'
        },
        {
          value: 'mobile',
          label: 'Mobile Application',
          description: 'Create a mobile app for iOS and Android',
          icon: '📱'
        },
        {
          value: 'api',
          label: 'API Service',
          description: 'Design a RESTful or GraphQL API',
          icon: '🔌'
        },
        {
          value: 'cli',
          label: 'CLI Tool',
          description: 'Build a command-line interface tool',
          icon: '⌨️'
        }
      ],
      required: true
    },
    {
      id: generateId(),
      type: 'checkbox' as WidgetType,
      title: 'Select features to include',
      description: 'Choose which features you want in your application',
      options: [
        {
          value: 'auth',
          label: 'Authentication',
          description: 'User login and registration'
        },
        {
          value: 'database',
          label: 'Database',
          description: 'Data persistence layer'
        },
        {
          value: 'api',
          label: 'API Integration',
          description: 'Connect to external services'
        },
        {
          value: 'realtime',
          label: 'Real-time Updates',
          description: 'WebSocket support for live data'
        }
      ],
      minSelection: 1,
      maxSelection: 4
    },
    {
      id: generateId(),
      type: 'progress' as WidgetType,
      title: 'Project Setup Progress',
      description: 'Setting up your development environment',
      value: 0,
      max: 100,
      status: 'active',
      showPercentage: true
    }
  ];
}

/**
 * Format widget response for AI consumption
 */
export function formatWidgetValues(values: Map<string, any>): string {
  const formatted: Record<string, any> = {};
  values.forEach((value, key) => {
    formatted[key] = value;
  });
  return JSON.stringify(formatted, null, 2);
}

/**
 * Create a widget response from user input
 */
export function createWidgetResponse(
  type: 'question' | 'confirmation' | 'form',
  widgets: Widget[]
): string {
  const response: WidgetResponse = {
    widgets,
    layout: widgets.length > 3 ? 'grouped' : 'single'
  };
  
  if (type === 'confirmation') {
    response.submitButton = { label: 'Confirm' };
    response.cancelButton = { label: 'Cancel', visible: true };
  } else if (type === 'form') {
    response.submitButton = { label: 'Submit' };
    response.cancelButton = { label: 'Reset', visible: true };
  }
  
  return `[WIDGETS]${JSON.stringify(response, null, 2)}[/WIDGETS]`;
}