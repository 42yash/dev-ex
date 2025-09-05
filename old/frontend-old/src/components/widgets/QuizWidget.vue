<template>
  <div class="quiz-widget">
    <h4>{{ widget.data.question }}</h4>
    <div class="options">
      <div
        v-for="(option, index) in widget.data.options"
        :key="index"
        class="option"
        :class="{
          selected: selectedOption === index,
          correct: submitted && option.correct,
          incorrect: submitted && selectedOption === index && !option.correct,
        }"
        @click="selectOption(index)"
      >
        {{ option.text }}
      </div>
    </div>
    <button @click="submit" :disabled="selectedOption === null || submitted">
      Submit
    </button>
    <div v-if="feedback" :class="['feedback', feedbackType]">
      {{ feedback }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Widget } from './WidgetManager.vue';

const props = defineProps<{
  widget: Widget;
}>();

const emit = defineEmits<{
  (e: 'interact', widget: any, interaction: any): void;
  (e: 'update', widget: any, update: any): void;
}>();

const selectedOption = ref<number | null>(null);
const submitted = ref(false);
const feedback = ref('');
const feedbackType = ref<'correct' | 'incorrect' | 'info'>('info');

function selectOption(index: number) {
  if (!submitted.value) {
    selectedOption.value = index;
  }
}

function submit() {
  if (selectedOption.value !== null) {
    submitted.value = true;
    emit('interact', props.widget, {
      action: 'submit',
      selectedOptionIndex: selectedOption.value,
    });
  }
}

watch(() => props.widget.data.correct, (isCorrect) => {
  if (isCorrect !== undefined) {
    submitted.value = true;
    feedback.value = props.widget.data.feedback || '';
    feedbackType.value = isCorrect ? 'correct' : 'incorrect';
  }
});

watch(() => props.widget.data.feedback, (newFeedback) => {
  if (newFeedback !== undefined) {
    feedback.value = newFeedback;
  }
});
</script>

<style scoped>
.quiz-widget {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.options {
  margin: 1em 0;
}

.option {
  padding: 0.5em;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 0.5em;
  cursor: pointer;
}

.option.selected {
  background-color: #eee;
}

.option.correct {
  background-color: #aeffa2;
}

.option.incorrect {
  background-color: #ffaca2;
}

.feedback {
  margin-top: 1em;
  font-weight: bold;
}

.feedback.correct {
  color: green;
}

.feedback.incorrect {
  color: red;
}
</style>
