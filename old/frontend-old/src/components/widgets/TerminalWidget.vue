<template>
  <div class="terminal-widget">
    <div ref="terminalContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

const terminalContainer = ref<HTMLElement | null>(null);
const term = new Terminal();
const fitAddon = new FitAddon();

onMounted(() => {
  if (terminalContainer.value) {
    term.loadAddon(fitAddon);
    term.open(terminalContainer.value);
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());

    if (props.widget.data && props.widget.data.initialOutput) {
      term.write(props.widget.data.initialOutput);
    }

    term.onData(data => {
      // For now, just echo the data back to the terminal
      term.write(data);
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', () => fitAddon.fit());
  term.dispose();
});
</script>

<style scoped>
.terminal-widget {
  padding: 1rem;
  background: #000;
  border-radius: var(--radius);
  height: 400px;
}
</style>
