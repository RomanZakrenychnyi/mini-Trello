<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { request, type BoardList } from '../api';
import ListCards from './ListCards.vue';
import { createDragScroll } from '../dragScroll';

const props = defineProps<{ list: BoardList; index: number; total: number; movementDisabled: boolean }>();
const emit = defineEmits<{ updated: [list: BoardList]; removed: [id: string]; move: [position: number]; dragging: [active: boolean] }>();
const column = ref<HTMLElement | null>(null);
const draggingColumn = ref(false);
let origin: { x: number; y: number; offsetX: number; offsetY: number; width: number } | null = null;
let ghost: HTMLElement | null = null;
let marker: HTMLElement | null = null;
let dropPosition: number | null = null;
const dragScroll = createDragScroll();
function clearMarker() { marker?.removeAttribute('data-column-drop'); marker = null; }
function cancelDrag() {
  dragScroll.stop();
  origin = null;
  draggingColumn.value = false;
  ghost?.remove(); ghost = null;
  clearMarker(); dropPosition = null;
  window.removeEventListener('keydown', escapeDrag);
  emit('dragging', false);
}
function escapeDrag(event: KeyboardEvent) { if (event.key === 'Escape') cancelDrag(); }
function startDrag(event: PointerEvent) {
  if (props.movementDisabled || busy.value || event.button !== 0 || !column.value) return;
  const rect = column.value.getBoundingClientRect();
  origin = { x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  window.addEventListener('keydown', escapeDrag);
}
function drag(event: PointerEvent) {
  if (!origin || !column.value) return;
  if (!ghost && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 6) return;
  if (!ghost) {
    ghost = column.value.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-list-index');
    ghost.removeAttribute('aria-label');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.querySelectorAll('[id]').forEach(item => item.removeAttribute('id'));
    ghost.classList.add('list-drag-preview');
    ghost.style.width = `${origin.width}px`;
    document.body.append(ghost);
    draggingColumn.value = true;
    emit('dragging', true);
  }
  ghost.style.transform = `translate3d(${event.clientX - origin.offsetX}px, ${event.clientY - origin.offsetY}px, 0)`;
  const row = column.value.closest<HTMLElement>('.lists-row');
  if (!row) return;
  dragScroll.move(event.clientX, event.clientY, row, () => updateTarget(event, row));
  updateTarget(event, row);
}
function updateTarget(event: PointerEvent, row: HTMLElement) {
  const bounds = row.getBoundingClientRect();
  clearMarker(); dropPosition = null;
  if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) return;
  const columns = [...row.querySelectorAll<HTMLElement>('[data-list-index]')];
  const hovered = columns.find(item => event.clientX < item.getBoundingClientRect().right) ?? columns.at(-1);
  if (!hovered) return;
  const rect = hovered.getBoundingClientRect();
  const after = event.clientX >= rect.left + rect.width / 2;
  const index = Number(hovered.dataset.listIndex) + (after ? 1 : 0);
  dropPosition = index > props.index ? index - 1 : index;
  marker = hovered;
  marker.dataset.columnDrop = after ? 'after' : 'before';
}
function releaseDrag() {
  const position = ghost ? dropPosition : null;
  cancelDrag();
  if (position !== null) emit('move', position);
}
onBeforeUnmount(cancelDrag);
const editing = ref(false);
const confirming = ref(false);
const name = ref('');
const busy = ref(false);
const error = ref('');
const cardCount = ref<number | null>(null);
const input = ref<HTMLInputElement | null>(null);
const renameButton = ref<HTMLButtonElement | null>(null);
const deleteButton = ref<HTMLButtonElement | null>(null);
const confirmation = ref<HTMLElement | null>(null);
async function confirmDeletion() {
  confirming.value = true; error.value = '';
  await nextTick();
  confirmation.value?.focus();
}
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
  if (busy.value) return;
  const wasDeleting = confirming.value;
  editing.value = false;
  confirming.value = false;
  error.value = '';
  await nextTick();
  (wasDeleting ? deleteButton.value : renameButton.value)?.focus();
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
    busy.value = false;
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
  <article ref="column" class="list-column" :class="{ 'list-drag-origin': draggingColumn }" :data-list-index="index" :aria-label="`Список ${list.name}`" :aria-busy="busy">
    <form v-if="editing" @submit.prevent="rename" @keydown.esc.stop.prevent="cancel">
      <label :for="`rename-${list.id}`">Название списка</label>
      <input :id="`rename-${list.id}`" ref="input" v-model="name" required maxlength="100" :disabled="busy" :aria-invalid="!!error" :aria-describedby="error ? `error-${list.id}` : undefined" @keydown.esc="!busy && cancel()" />
      <div class="list-actions"><button :disabled="busy">{{ busy ? 'Сохраняем…' : 'Сохранить' }}</button><button type="button" class="secondary" :disabled="busy" @click="cancel">Отмена</button></div>
    </form>
    <div v-else class="list-heading">
      <h3 class="column-drag-handle" :title="`Перетащить список ${list.name}`" @pointerdown.prevent="startDrag" @pointermove="drag" @pointerup="releaseDrag" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag"><span class="column-grip" aria-hidden="true">⠿</span> {{ list.name }} <span v-if="cardCount !== null" class="list-count" :aria-label="`Карточек: ${cardCount}`">{{ cardCount }}</span></h3>
      <div class="list-order-actions">
        <button class="secondary" :disabled="movementDisabled || busy || index === 0" :aria-label="`Переместить список ${list.name} влево`" @click="emit('move', index - 1)">←</button>
        <button class="secondary" :disabled="movementDisabled || busy || index === total - 1" :aria-label="`Переместить список ${list.name} вправо`" @click="emit('move', index + 1)">→</button>
      </div>
    </div>
    <ListCards :board-id="list.boardId" :list-id="list.id" @count="cardCount = $event" />
    <template v-if="!editing">
      <div v-if="confirming" class="delete-confirm" @keydown.esc.stop.prevent="cancel">
        <p ref="confirmation" tabindex="-1">Удалить пустой список «{{ list.name }}»?</p>
        <div class="list-actions"><button class="danger" :disabled="busy" @click="remove">{{ busy ? 'Удаляем…' : 'Да, удалить' }}</button><button class="secondary" :disabled="busy" @click="cancel">Отмена</button></div>
      </div>
      <div v-else class="list-actions"><button ref="renameButton" class="secondary" @click="edit">Переименовать</button><button ref="deleteButton" class="danger-link" :disabled="cardCount !== 0" :title="cardCount ? 'Сначала удалите карточки из списка' : undefined" @click="confirmDeletion">Удалить</button></div>
      <p v-if="cardCount" class="list-hint">Чтобы удалить список, сначала удалите его карточки.</p>
    </template>
    <p v-if="error" :id="`error-${list.id}`" class="error" role="alert">{{ error }}</p>
  </article>
</template>
