<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { cardMovement } from '../cardMovement';
import { request, type Card, type CardInput } from '../api';
import CardForm from './CardForm.vue';

const props = defineProps<{ card: Card; path: string; index: number; total: number }>();
const movement = inject(cardMovement)!;
function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const today = ref(localDay());
let dayTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { dayTimer = setInterval(() => { today.value = localDay(); }, 30000); });
onBeforeUnmount(() => clearInterval(dayTimer));
const overdue = computed(() => !!props.card.dueDate && !props.card.completed && props.card.dueDate < today.value);
const formattedDate = computed(() => props.card.dueDate?.split('-').reverse().join('.'));
let pointerStart: { x: number; y: number; offsetX: number; offsetY: number; width: number; height: number } | null = null;
const article = ref<HTMLElement | null>(null);
let settleTimer: ReturnType<typeof setTimeout> | undefined;
function start(event: PointerEvent) {
  if (busy.value || movement.moving.value || movement.searchActive.value || movement.preview.value?.settling || event.button !== 0 || !article.value) return;
  const rect = article.value.getBoundingClientRect();
  pointerStart = { x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height };
  window.addEventListener('keydown', escapeDrag);
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function destination(event: PointerEvent) {
  const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drop-list]');
  return zone ? { listId: zone.dataset.dropList!, index: Number(zone.dataset.dropIndex) } : null;
}
function pointerMove(event: PointerEvent) {
  if (!pointerStart) return;
  if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 6) return;
  movement.dragged.value = props.card;
  movement.preview.value = { x: event.clientX - pointerStart.offsetX, y: event.clientY - pointerStart.offsetY, width: pointerStart.width, height: pointerStart.height, settling: false };
  movement.target.value = destination(event);
}
function release(event: PointerEvent) {
  const origin = pointerStart;
  pointerStart = null;
  window.removeEventListener('keydown', escapeDrag);
  const target = destination(event);
  const active = movement.dragged.value?.id === props.card.id;
  if (!active) return;
  const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drop-list]');
  const rect = (zone ?? article.value)?.getBoundingClientRect();
  const preview = movement.preview.value;
  if (preview && rect) {
    movement.preview.value = { ...preview,
      x: !zone && origin ? origin.x - origin.offsetX : rect.left,
      y: !zone && origin ? origin.y - origin.offsetY : zone?.classList.contains('list-cards') ? rect.bottom - preview.height : rect.top,
      settling: true };
  }
  settleTimer = setTimeout(() => {
    movement.preview.value = null;
    movement.dragged.value = null;
    movement.target.value = null;
    if (!target) return;
    const position = target.listId === props.card.listId && props.index < target.index ? target.index - 1 : target.index;
    void movement.move(props.card, target.listId, position);
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
}
function cancelDrag() {
  if (!pointerStart) return;
  pointerStart = null;
  window.removeEventListener('keydown', escapeDrag);
  movement.dragged.value = null;
  movement.target.value = null;
  movement.preview.value = null;
}
function escapeDrag(event: KeyboardEvent) { if (event.key === 'Escape') cancelDrag(); }
onBeforeUnmount(() => {
  cancelDrag();
  clearTimeout(settleTimer);
  if (movement.dragged.value?.id === props.card.id) {
    movement.dragged.value = null;
    movement.target.value = null;
    movement.preview.value = null;
  }
});
function transfer(event: Event) {
  const target = (event.target as HTMLSelectElement).value;
  (event.target as HTMLSelectElement).value = '';
  if (target) void movement.move(props.card, target, 0);
}
const emit = defineEmits<{ updated: [card: Card]; removed: [id: string] }>();
const editing = ref(false);
const confirming = ref(false);
const busy = ref(false);
const error = ref('');
function cancel() { editing.value = false; confirming.value = false; error.value = ''; }
async function save(data: CardInput) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const card = await request<Card>(`${props.path}/${props.card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    emit('updated', card);
    cancel();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось сохранить карточку'; }
  finally { busy.value = false; }
}
async function toggleCompleted() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    emit('updated', await request<Card>(`${props.path}/${props.card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !props.card.completed }) }));
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось изменить отметку выполнения'; }
  finally { busy.value = false; }
}
async function remove() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await request<{ id: string }>(`${props.path}/${props.card.id}`, { method: 'DELETE' });
    emit('removed', props.card.id);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Не удалось удалить карточку'; }
  finally { busy.value = false; }
}
</script>

<template>
  <article ref="article" class="task-card" :class="{ 'card-drag-origin': movement.dragged.value?.id === card.id, 'card-overdue': overdue, 'card-completed': card.completed }" :aria-label="`Карточка ${card.title}`" :aria-busy="busy">
    <CardForm v-if="editing" :id="card.id" :initial-title="card.title" :initial-description="card.description" :initial-due-date="card.dueDate" :initial-completed="card.completed" :busy="busy" submit-label="Сохранить карточку" @save="save" @cancel="cancel" />
    <template v-else>
      <span v-if="!movement.searchActive.value" class="drag-handle secondary" role="img" :aria-label="`Перетащить карточку ${card.title}`" title="Перетащить карточку" @pointerdown.prevent="start" @pointermove="pointerMove" @pointerup="release" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag">⠿</span>
      <h4>{{ card.title }}</h4>
      <p v-if="card.dueDate" class="card-deadline" :class="{ 'deadline-overdue': overdue }"><time :datetime="card.dueDate">Срок: {{ formattedDate }}</time><span v-if="overdue"> · Просрочено</span></p>
      <button class="completion-button secondary" :aria-pressed="card.completed" :disabled="busy || movement.moving.value" @click="toggleCompleted">{{ card.completed ? '✓ Выполнено' : 'Отметить выполненной' }}</button>
      <p v-if="card.description" class="card-description">{{ card.description }}</p>
      <div v-if="!confirming" class="card-movement">
        <button class="secondary" :disabled="busy || movement.moving.value || movement.searchActive.value || index === 0" aria-label="Переместить карточку выше" @click="movement.move(card, card.listId, index - 1)">↑</button>
        <button class="secondary" :disabled="busy || movement.moving.value || movement.searchActive.value || index === total - 1" aria-label="Переместить карточку ниже" @click="movement.move(card, card.listId, index + 1)">↓</button>
        <select aria-label="Переместить в начало другого списка" :disabled="busy || movement.moving.value || movement.searchActive.value" @change="transfer">
          <option value="">В другой список…</option>
          <option v-for="list in movement.lists.value.filter(item => item.id !== card.listId)" :key="list.id" :value="list.id">{{ list.name }}</option>
        </select>
      </div>
      <div v-if="confirming"><p>Удалить карточку «{{ card.title }}»?</p><div class="list-actions"><button class="danger" :disabled="busy" @click="remove">{{ busy ? 'Удаляем…' : 'Да, удалить карточку' }}</button><button class="secondary" :disabled="busy" @click="cancel">Отмена</button></div></div>
      <div v-else class="list-actions"><button class="secondary" @click="editing = true; error = ''">Редактировать</button><button class="danger-link" @click="confirming = true; error = ''">Удалить карточку</button></div>
    </template>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </article>
</template>
