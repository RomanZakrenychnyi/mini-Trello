<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { request, type Board } from '../api';

const props = defineProps<{ board: Board }>();
const emit = defineEmits<{ updated: [board: Board]; removed: [] }>();
const mode = ref<'idle' | 'rename' | 'delete'>('idle');
const name = ref('');
const busy = ref(false);
const error = ref('');
const counts = ref<{ lists: number; cards: number } | null>(null);
const input = ref<HTMLInputElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const deleteTrigger = ref<HTMLButtonElement | null>(null);
const confirmation = ref<HTMLHeadingElement | null>(null);
const path = `/boards/${encodeURIComponent(props.board.id)}`;

async function renameMode() {
  name.value = props.board.name;
  error.value = '';
  mode.value = 'rename';
  await nextTick();
  input.value?.focus();
  input.value?.select();
}
async function cancel() {
  if (busy.value) return;
  const wasDeleting = mode.value === 'delete';
  mode.value = 'idle';
  error.value = '';
  await nextTick();
  (wasDeleting ? deleteTrigger.value : trigger.value)?.focus();
}
async function rename() {
  if (busy.value) return;
  error.value = '';
  const trimmed = name.value.trim();
  if (!trimmed || trimmed.length > 100) { error.value = 'Название должно содержать от 1 до 100 символов'; return; }
  busy.value = true;
  try {
    emit('updated', await request<Board>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) }));
    busy.value = false;
    await cancel();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось переименовать доску'; }
  finally { busy.value = false; }
}
async function deletionMode() {
  mode.value = 'delete';
  counts.value = null;
  error.value = '';
  busy.value = true;
  await nextTick();
  confirmation.value?.focus();
  try { counts.value = await request(`${path}/deletion-preview`); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось проверить содержимое доски'; }
  finally { busy.value = false; }
}
async function remove() {
  if (busy.value || !counts.value) return;
  busy.value = true;
  error.value = '';
  try { await request(path, { method: 'DELETE' }); emit('removed'); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось удалить доску'; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="board-actions" :aria-busy="busy">
    <div v-if="mode === 'idle'" class="list-actions">
      <button ref="trigger" class="secondary" @click="renameMode">Переименовать доску</button>
      <button ref="deleteTrigger" class="danger-link" @click="deletionMode">Удалить доску</button>
    </div>
    <form v-else-if="mode === 'rename'" class="board-action-panel" @submit.prevent="rename" @keydown.esc="cancel">
      <label for="rename-board">Название доски</label>
      <input id="rename-board" ref="input" v-model="name" required maxlength="100" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? 'board-action-error' : undefined" />
      <div class="list-actions"><button :disabled="busy">{{ busy ? 'Сохраняем…' : 'Сохранить название' }}</button><button type="button" class="secondary" :disabled="busy" @click="cancel">Отмена</button></div>
    </form>
    <div v-else class="board-action-panel board-delete-panel" @keydown.esc="cancel">
      <h2 ref="confirmation" tabindex="-1">Удалить доску «{{ board.name }}»?</h2>
      <p v-if="busy && !counts" role="status">Проверяем содержимое…</p>
      <p v-if="counts">Списков: {{ counts.lists }}. Карточек: {{ counts.cards }}.</p>
      <p>Доска и все её списки, карточки и чек-листы будут удалены без возможности восстановления.</p>
      <div class="list-actions">
        <button class="danger" :disabled="busy || !counts" @click="remove">{{ busy && counts ? 'Удаляем…' : 'Удалить доску навсегда' }}</button>
        <button v-if="!counts && !busy" class="secondary" @click="deletionMode">Повторить проверку</button>
        <button class="secondary" :disabled="busy" @click="cancel">Отмена</button>
      </div>
    </div>
    <p v-if="error" id="board-action-error" class="error" role="alert">{{ error }}</p>
  </div>
</template>
