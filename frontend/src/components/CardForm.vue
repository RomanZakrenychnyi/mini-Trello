<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ id: string; initialTitle?: string; initialDescription?: string; busy: boolean; submitLabel: string }>();
const emit = defineEmits<{ save: [data: { title: string; description: string }]; cancel: [] }>();
const title = ref(props.initialTitle ?? '');
const description = ref(props.initialDescription ?? '');
const error = ref('');
function submit() {
  if (props.busy) return;
  error.value = '';
  if (!title.value.trim() || title.value.trim().length > 200) {
    error.value = 'Название должно содержать от 1 до 200 символов';
    return;
  }
  if (description.value.length > 5000) {
    error.value = 'Описание не должно превышать 5000 символов';
    return;
  }
  emit('save', { title: title.value.trim(), description: description.value });
}
</script>

<template>
  <form class="card-form" @submit.prevent="submit">
    <label :for="`${id}-title`">Название карточки</label>
    <input :id="`${id}-title`" v-model="title" maxlength="200" required :disabled="busy" :aria-describedby="error ? `${id}-error` : undefined" />
    <label :for="`${id}-description`">Описание</label>
    <textarea :id="`${id}-description`" v-model="description" maxlength="5000" rows="4" :disabled="busy" placeholder="Необязательно" />
    <p v-if="error" :id="`${id}-error`" role="alert" class="error">{{ error }}</p>
    <div class="list-actions"><button :disabled="busy">{{ busy ? 'Сохраняем…' : submitLabel }}</button><button type="button" class="secondary" :disabled="busy" @click="emit('cancel')">Отмена</button></div>
  </form>
</template>
