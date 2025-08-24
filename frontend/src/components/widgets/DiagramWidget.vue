<template>
  <div class="diagram-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="diagram-container">
      <!-- Placeholder for diagram rendering -->
      <div class="diagram-placeholder">
        <div class="diagram-type">{{ widget.diagramType }} Diagram</div>
        <pre class="diagram-content">{{ widget.content }}</pre>
        <div class="diagram-note">
          Renderer: {{ widget.renderer || 'mermaid' }}
        </div>
      </div>
      <!-- In production, integrate with mermaid.js, PlantUML, or D2 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import type { DiagramWidget } from '@/types/widget';

interface Props {
  widget: DiagramWidget;
}

const props = defineProps<Props>();

const renderDiagram = () => {
  // In production, this would render the actual diagram using:
  // - mermaid.js for mermaid diagrams
  // - PlantUML server for PlantUML
  // - D2 renderer for D2 diagrams
  console.log('Rendering diagram:', props.widget.diagramType, props.widget.renderer);
};

onMounted(() => {
  renderDiagram();
});

watch(() => props.widget.content, () => {
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