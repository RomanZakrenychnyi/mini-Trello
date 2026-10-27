<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { request, type BoardList } from '../api';

const props = defineProps<{ list: BoardList }>();
const emit = defineEmits<{ updated: [list: BoardList]; removed: [id: string] }>();
const editing = ref(false);
const confirming = ref(false);
const name = ref('');
const busy = ref(false);
const error = ref('');
const input = ref<HTMLInputElement | null>(null);
const renameButton = ref<HTMLButtonElement | null>(null);
const path = `/boards/${encodeURIComponent(props.list.boardId)}/lists/${encodeURIComponent(props.list.id)}`;

async function edit() {
  name.value = props.list.name;
  error.value = '';
  confirming.value = false;
  editing.value = true;
  await nextTick();
  input.value?.focus();
  input.value?.select();
}

async function cancel() {
  editing.value = false;
  confirming.value = false;
  error.value = '';
  await nextTick();
  renameButton.value?.focus();
}

async function rename() {
  if (busy.value) return;
  error.value = '';
  const trimmed = name.value.trim();
  if (!trimmed || trimmed.length > 100) {
    error.value = 'Название должно содержать от 1 до 100 символов';
    return;
  }
  busy.value = true;
  try {
    const result = await request<BoardList>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) });
    emit('updated', result);
    await cancel();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось переименовать список'; }
  finally { busy.value = false; }
}

async function remove() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await request<{ id: string }>(path, { method: 'DELETE' });
    emit('removed', props.list.id);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось удалить список'; }
  finally { busy.value = false; }
}
</script>

<template>
  <article class="list-column" :aria-label="`Список ${list.name}`" :aria-busy="busy">
    <form v-if="editing" @submit.prevent="rename">
      <label :for="`rename-${list.id}`">Название списка</label>
      <input :id="`rename-${list.id}`" ref="input" v-model="name" required maxlength="100" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? `error-${list.id}` : undefined" @keydown.esc="!busy && cancel()" />
      <div class="list-actions"><button :disabled="busy">{{ busy ? 'Сохраняем…' : 'Сохранить' }}</button><button type="button" class="secondary" :disabled="busy" @click="cancel">Отмена</button></div>
    </form>
    <template v-else>
      <h3>{{ list.name }}</h3>
      <p class="list-placeholder">Пока нет карточек</p>
      <div v-if="confirming" class="delete-confirm">
        <p>Удалить пустой список «{{ list.name }}»?</p>
        <div class="list-actions"><button class="danger" :disabled="busy" @click="remove">{{ busy ? 'Удаляем…' : 'Да, удалить' }}</button><button class="secondary" :disabled="busy" @click="cancel">Отмена</button></div>
      </div>
      <div v-else class="list-actions"><button ref="renameButton" class="secondary" @click="edit">Переименовать</button><button class="danger-link" @click="confirming = true; error = ''">Удалить</button></div>
    </template>
    <p v-if="error" :id="`error-${list.id}`" class="error" role="alert">{{ error }}</p>
  </article>
</template>
