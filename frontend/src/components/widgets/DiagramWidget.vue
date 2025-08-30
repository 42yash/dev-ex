<template>
  <div class="diagram-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="diagram-container">
      <div v-if="renderError" class="diagram-error">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{{ renderError }}</span>
      </div>
      <div v-else-if="widget.renderer === 'mermaid'" ref="mermaidContainer" class="mermaid-diagram">
        {{ widget.content }}
      </div>
      <div v-else class="diagram-placeholder">
        <div class="diagram-type">{{ widget.diagramType }} Diagram</div>
        <pre class="diagram-content">{{ widget.content }}</pre>
        <div class="diagram-note">
          Renderer: {{ widget.renderer || 'mermaid' }} (not yet implemented)
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import mermaid from 'mermaid';
import type { DiagramWidget } from '@/types/widget';

interface Props {
  widget: DiagramWidget;
}

const props = defineProps<Props>();
const mermaidContainer = ref<HTMLDivElement>();
const renderError = ref<string | null>(null);

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#2563eb',
    lineColor: '#6b7280',
    secondaryColor: '#f3f4f6',
    tertiaryColor: '#fff'
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis'
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35
  },
  gantt: {
    numberSectionStyles: 4,
    axisFormat: '%Y-%m-%d'
  }
});

const renderDiagram = async () => {
  renderError.value = null;
  
  if (props.widget.renderer === 'mermaid' && mermaidContainer.value) {
    try {
      // Clear previous content
      mermaidContainer.value.innerHTML = props.widget.content;
      mermaidContainer.value.removeAttribute('data-processed');
      
      // Generate unique ID for the diagram
      const id = `mermaid-${Date.now()}`;
      mermaidContainer.value.id = id;
      
      // Render mermaid diagram
      await nextTick();
      await mermaid.run({
        querySelector: `#${id}`
      });
    } catch (error) {
      console.error('Mermaid rendering error:', error);
      renderError.value = `Failed to render diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  } else if (props.widget.renderer === 'plantuml') {
    // PlantUML would require a server endpoint to render
    console.log('PlantUML rendering not yet implemented');
  } else if (props.widget.renderer === 'd2') {
    // D2 would require a server endpoint to render
    console.log('D2 rendering not yet implemented');
  }
};

onMounted(() => {
  renderDiagram();
});

watch(() => props.widget.content, () => {
  renderDiagram();
});

watch(() => props.widget.renderer, () => {
  renderDiagram();
});
</script>

<style scoped lang="scss">
.diagram-widget {
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
  
  .diagram-container {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 1rem;
    min-height: 200px;
    
    .diagram-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      color: var(--color-error);
      
      .error-icon {
        font-size: 1.25rem;
      }
      
      .error-message {
        flex: 1;
      }
    }
    
    .mermaid-diagram {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 150px;
      
      svg {
        max-width: 100%;
        height: auto;
      }
    }
    
    .diagram-placeholder {
      text-align: center;
      
      .diagram-type {
        font-weight: 600;
        color: var(--color-primary);
        margin-bottom: 1rem;
      }
      
      .diagram-content {
        text-align: left;
        background: var(--color-background-mute);
        padding: 1rem;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.875rem;
        overflow-x: auto;
        max-height: 300px;
        color: var(--color-text);
      }
      
      .diagram-note {
        margin-top: 1rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }
    }
  }
}
</style>