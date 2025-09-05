<template>
  <div class="media-widget">
    <img 
      v-if="widget.data.type === 'image'" 
      :src="widget.data.url" 
      :alt="widget.data.alt"
      @load="handleMediaLoad"
    />
    <video 
      v-else-if="widget.data.type === 'video'" 
      :src="widget.data.url" 
      controls
      @loadedmetadata="handleMediaLoad"
      @play="handleMediaPlay"
    ></video>
    <audio 
      v-else-if="widget.data.type === 'audio'" 
      :src="widget.data.url" 
      controls
      @loadedmetadata="handleMediaLoad"
      @play="handleMediaPlay"
    ></audio>
    <div v-else>Unsupported media type</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

const emit = defineEmits<{
  (e: 'interact', widget: any, interaction: any): void;
}>();

function handleMediaLoad() {
  emit('interact', props.widget, {
    action: 'view',
    mediaUrl: props.widget.data.url,
    metadata: { type: props.widget.data.type },
  });
}

function handleMediaPlay() {
  emit('interact', props.widget, {
    action: 'play',
    mediaUrl: props.widget.data.url,
    metadata: { type: props.widget.data.type },
  });
}

onMounted(() => {
  // For images, if already loaded by browser, emit view event
  if (props.widget.data.type === 'image') {
    const img = new Image();
    img.src = props.widget.data.url;
    img.onload = () => handleMediaLoad();
  }
});
</script>

<style scoped>
.media-widget {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.media-widget img,
.media-widget video,
.media-widget audio {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
}
</style>
