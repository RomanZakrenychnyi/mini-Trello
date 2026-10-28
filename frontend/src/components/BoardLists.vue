<script setup lang="ts">
import { onMounted, provide, ref } from 'vue';
import { request, type BoardList, type Card } from '../api';
import { cardMovement } from '../cardMovement';
import ListColumn from './ListColumn.vue';

const props = defineProps<{ boardId: string }>();
const lists = ref<BoardList[]>([]);
const loading = ref(true);
const loadError = ref('');
const createError = ref('');
const name = ref('');
const saving = ref(false);
const path = `/boards/${encodeURIComponent(props.boardId)}/lists`;
const dragged = ref<Card | null>(null);
const target = ref<{ listId: string; index: number } | null>(null);
const preview = ref<{ x: number; y: number; width: number; height: number; settling: boolean } | null>(null);
const moving = ref(false);
const revision = ref(0);
const moveError = ref('');
const moveStatus = ref('');
async function move(card: Card, targetListId: string, position: number) {
  if (moving.value) return;
  moving.value = true;
  dragged.value = null;
  target.value = null;
  moveError.value = '';
  moveStatus.value = 'Сохраняем перемещение…';
  try {
    await request(`${path}/${encodeURIComponent(card.listId)}/cards/${encodeURIComponent(card.id)}/move`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetListId, position }),
    });
    moveStatus.value = 'Перемещение сохранено';
  } catch (cause) {
    moveStatus.value = '';
    moveError.value = cause instanceof Error ? cause.message : 'Не удалось переместить карточку';
  } finally { revision.value++; moving.value = false; }
}
provide(cardMovement, { lists, dragged, target, preview, moving, revision, move });

async function load() {
  loading.value = true;
  loadError.value = '';
  try { lists.value = await request<BoardList[]>(path); }
  catch (error) { loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить списки'; }
  finally { loading.value = false; }
}

async function create() {
  if (saving.value) return;
  createError.value = '';
  const trimmed = name.value.trim();
  if (!trimmed || trimmed.length > 100) {
    createError.value = 'Название должно содержать от 1 до 100 символов';
    return;
  }
  saving.value = true;
  try {
    const list = await request<BoardList>(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }),
    });
    lists.value.push(list);
    lists.value.sort((a, b) => a.position - b.position);
    name.value = '';
  } catch (error) { createError.value = error instanceof Error ? error.message : 'Не удалось создать список'; }
  finally { saving.value = false; }
}

function updated(list: BoardList) {
  lists.value = lists.value.map((item) => item.id === list.id ? list : item);
}

onMounted(load);
</script>

<template>
  <section aria-labelledby="lists-title" :aria-busy="loading">
    <h2 id="lists-title">Списки доски</h2>
    <p class="list-hint">Перетаскивайте карточки за ручку «⠿» или используйте кнопки перемещения.</p>
    <p role="status">{{ moveStatus }}</p>
    <p v-if="moveError" class="error" role="alert">{{ moveError }}</p>
    <p v-if="loading" role="status">Загружаем списки…</p>
    <div v-else-if="loadError" role="alert"><p class="error">{{ loadError }}</p><button @click="load">Повторить загрузку</button></div>
    <template v-else>
      <p v-if="lists.length === 0" class="intro">На доске пока нет списков. Добавьте первый — например, «Нужно сделать».</p>
      <fieldset class="lists-row" :disabled="moving || preview?.settling">
        <ListColumn v-for="list in lists" :key="list.id" :list="list" @updated="updated" @removed="lists = lists.filter((item) => item.id !== $event)" />
        <form class="list-create" @submit.prevent="create">
          <h3>Новый список</h3>
          <label for="list-name">Название списка</label>
          <input id="list-name" v-model="name" required maxlength="100" :disabled="saving" placeholder="Например, В работе" :aria-invalid="!!createError" :aria-describedby="createError ? 'list-create-error' : undefined" />
          <p v-if="createError" id="list-create-error" class="error" role="alert">{{ createError }}</p>
          <button :disabled="saving">{{ saving ? 'Добавляем…' : 'Добавить список' }}</button>
        </form>
      </fieldset>
    </template>
  </section>
  <Teleport to="body">
    <article v-if="preview && dragged" class="task-card drag-preview" :class="{ 'drag-settling': preview.settling }" aria-hidden="true" :style="{ width: `${preview.width}px`, height: `${preview.height}px`, transform: `translate3d(${preview.x}px, ${preview.y}px, 0)` }">
      <span class="drag-handle secondary">⠿</span>
      <h4>{{ dragged.title }}</h4>
      <p v-if="dragged.description" class="card-description">{{ dragged.description }}</p>
      <div class="card-movement"><span class="secondary preview-button">↑</span><span class="secondary preview-button">↓</span><span class="preview-list">В другой список…</span></div>
      <div class="list-actions"><span class="secondary preview-button">Редактировать</span><span class="danger-link preview-button">Удалить карточку</span></div>
    </article>
  </Teleport>
</template>
