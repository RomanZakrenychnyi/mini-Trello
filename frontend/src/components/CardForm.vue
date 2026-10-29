<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CardInput } from '../api';

const props = defineProps<{ id: string; initialTitle?: string; initialDescription?: string; initialDueDate?: string | null; initialCompleted?: boolean; busy: boolean; submitLabel: string }>();
const emit = defineEmits<{ save: [data: CardInput]; cancel: [] }>();
const title = ref(props.initialTitle ?? '');
const description = ref(props.initialDescription ?? '');
const dueDate = ref(props.initialDueDate ?? '');
const completed = ref(props.initialCompleted ?? false);
const error = ref('');
const titleInput = ref<HTMLInputElement | null>(null);
onMounted(() => {
  titleInput.value?.focus();
  titleInput.value?.closest('form')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
function submit() {
  if (props.busy) return;
  error.value = '';
  if (!title.value.trim() || title.value.trim().length > 200) {
    error.value = 'Название должно содержать от 1 до 200 символов';
    titleInput.value?.focus();
    return;
  }
  if (description.value.length > 5000) {
    error.value = 'Описание не должно превышать 5000 символов';
    return;
  }
  emit('save', { title: title.value.trim(), description: description.value, dueDate: dueDate.value || null, completed: completed.value });
}
</script>

<template>
  <form class="card-form" @submit.prevent="submit" @keydown.esc.stop.prevent="!busy && emit('cancel')">
    <label :for="`${id}-title`">Название карточки</label>
    <input :id="`${id}-title`" ref="titleInput" v-model="title" maxlength="200" required :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? `${id}-error` : undefined" />
    <label :for="`${id}-description`">Описание</label>
    <textarea :id="`${id}-description`" v-model="description" maxlength="5000" rows="4" :disabled="busy" placeholder="Необязательно" />
    <label :for="`${id}-due-date`">Срок выполнения</label>
    <input :id="`${id}-due-date`" v-model="dueDate" type="date" min="0001-01-01" max="9999-12-31" :disabled="busy" />
    <button v-if="dueDate" type="button" class="secondary clear-date" :disabled="busy" @click="dueDate = ''">Убрать срок</button>
    <label class="completion-toggle"><input v-model="completed" type="checkbox" :disabled="busy" /> Выполнено</label>
    <p v-if="error" :id="`${id}-error`" role="alert" class="error">{{ error }}</p>
    <div class="list-actions"><button :disabled="busy">{{ busy ? 'Сохраняем…' : submitLabel }}</button><button type="button" class="secondary" :disabled="busy" @click="emit('cancel')">Отмена</button></div>
  </form>
</template>
