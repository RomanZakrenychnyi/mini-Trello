<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { request, type BoardList, type Card } from '../api';
import { cardMovement } from '../cardMovement';
import { boardSearch, localDay, type CardFilter } from '../boardSearch';
import ListColumn from './ListColumn.vue';

const props = defineProps<{ boardId: string }>();
const lists = ref<BoardList[]>([]);
const query = ref('');
const filter = ref<CardFilter>('all');
const today = ref(localDay());
let dayTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => { dayTimer = setInterval(() => { today.value = localDay(); }, 30000); });
onBeforeUnmount(() => clearInterval(dayTimer));
const searchActive = computed(() => query.value.trim().length > 0 || filter.value !== 'all');
function resetFilters() { query.value = ''; filter.value = 'all'; }
const searchResults = ref<Record<string, { count: number; failed: boolean } | null>>({});
const resultsLoading = computed(() => lists.value.some(list => !searchResults.value[list.id]));
const resultsFailed = computed(() => lists.value.some(list => searchResults.value[list.id]?.failed));
const resultCount = computed(() => lists.value.reduce((sum, list) => sum + (searchResults.value[list.id]?.count ?? 0), 0));
provide(boardSearch, { query, filter, today, report: (id, result) => { searchResults.value[id] = result; } });
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
const columnDragging = ref(false);
const movementBusy = computed(() => moving.value || columnDragging.value);
const revision = ref(0);
const moveError = ref('');
const moveStatus = ref('');
async function move(card: Card, targetListId: string, position: number) {
  if (moving.value || searchActive.value) return;
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
provide(cardMovement, { lists, dragged, target, preview, moving: movementBusy, searchActive, revision, move });

async function moveList(list: BoardList, position: number) {
  if (moving.value || dragged.value || columnDragging.value || saving.value) return;
  const current = lists.value.findIndex(item => item.id === list.id);
  if (current === position || position < 0 || position >= lists.value.length) return;
  moving.value = true;
  moveError.value = '';
  moveStatus.value = 'Сохраняем порядок списков…';
  try {
    lists.value = await request<BoardList[]>(`${path}/${encodeURIComponent(list.id)}/move`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position }),
    });
    moveStatus.value = 'Порядок списков сохранён';
  } catch (cause) {
    moveStatus.value = '';
    moveError.value = cause instanceof Error ? cause.message : 'Не удалось переместить список';
    try { lists.value = await request<BoardList[]>(path); }
    catch { moveError.value += ' Не удалось обновить порядок. Обновите страницу перед повторной попыткой.'; }
  } finally { moving.value = false; }
}

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
    <div class="lists-section-heading"><h2 id="lists-title">Списки доски <span class="count">{{ lists.length }}</span></h2>
    <p class="list-hint">Списки — за заголовок, карточки — за «⠿»</p></div>
    <p role="status">{{ moveStatus }}</p>
    <p v-if="moveError" class="error" role="alert">{{ moveError }}</p>
    <p v-if="loading" class="loading-state" role="status">Загружаем списки…</p>
    <div v-else-if="loadError" role="alert"><p class="error">{{ loadError }}</p><button @click="load">Повторить загрузку</button></div>
    <template v-else>
      <div class="board-search">
        <div class="search-input-group">
        <label for="card-search">Поиск карточек на доске</label>
        <div class="form-row">
          <input id="card-search" v-model="query" type="search" placeholder="Название или описание" :disabled="moving || !!dragged" aria-describedby="search-status" @keydown.esc="query = ''" />
          <button v-if="query" class="secondary" :disabled="moving || !!dragged" @click="query = ''">Сбросить поиск</button>
        </div>
        </div>
        <div class="card-filters">
          <label for="card-filter">Показать карточки</label>
          <select id="card-filter" v-model="filter" :disabled="moving || !!dragged" aria-describedby="search-status">
            <option value="all">Все</option>
            <option value="pending">Невыполненные</option>
            <option value="completed">Выполненные</option>
            <option value="overdue">Просроченные</option>
          </select>
          <button v-if="searchActive" class="secondary" :disabled="moving || !!dragged" @click="resetFilters">Сбросить все фильтры</button>
        </div>
        <p id="search-status" role="status" aria-live="polite" aria-atomic="true">
          <template v-if="searchActive">
            <template v-if="resultsLoading">Загружаем карточки…</template>
            <template v-else-if="resultsFailed">Найдено в загруженных списках: {{ resultCount }}. Поиск неполный: не все списки удалось загрузить.</template>
            <template v-else-if="resultCount === 0">Ничего не найдено</template>
            <template v-else>Найдено карточек: {{ resultCount }}</template>
          </template>
        </p>
        <p v-if="searchActive" class="list-hint">Чтобы перемещать карточки, сбросьте поиск и выберите «Все».</p>
      </div>
      <p v-if="lists.length === 0" class="intro">На доске пока нет списков. Добавьте первый — например, «Нужно сделать».</p>
      <fieldset class="lists-board" :disabled="moving || columnDragging || preview?.settling">
      <TransitionGroup name="list-order" tag="div" class="lists-row">
        <ListColumn v-for="(list, index) in lists" :key="list.id" :list="list" :index="index" :total="lists.length" :movement-disabled="moving || !!dragged || columnDragging || saving" @move="moveList(list, $event)" @dragging="columnDragging = $event" @updated="updated" @removed="lists = lists.filter((item) => item.id !== $event)" />
        <form key="new-list" class="list-create" @submit.prevent="create">
          <h3>Новый список</h3>
          <label for="list-name">Название списка</label>
          <input id="list-name" v-model="name" required maxlength="100" :disabled="saving" placeholder="Например, В работе" :aria-invalid="!!createError" :aria-describedby="createError ? 'list-create-error' : undefined" />
          <p v-if="createError" id="list-create-error" class="error" role="alert">{{ createError }}</p>
          <button :disabled="saving">{{ saving ? 'Добавляем…' : 'Добавить список' }}</button>
        </form>
      </TransitionGroup>
      </fieldset>
    </template>
  </section>
  <Teleport to="body">
    <article v-if="preview && dragged" class="task-card drag-preview" :class="{ 'drag-settling': preview.settling }" aria-hidden="true" :style="{ width: `${preview.width}px`, height: `${preview.height}px`, transform: `translate3d(${preview.x}px, ${preview.y}px, 0)` }">
      <span class="drag-handle secondary">⠿</span>
      <h4>{{ dragged.title }}</h4>
      <p v-if="dragged.dueDate" class="card-deadline">Срок: {{ dragged.dueDate.split('-').reverse().join('.') }}</p>
      <span class="completion-button secondary preview-button">{{ dragged.completed ? '✓ Выполнено' : 'Отметить выполненной' }}</span>
      <p v-if="dragged.description" class="card-description">{{ dragged.description }}</p>
      <div class="card-movement"><span class="secondary preview-button">↑</span><span class="secondary preview-button">↓</span><span class="preview-list">В другой список…</span></div>
      <div class="list-actions"><span class="secondary preview-button">Редактировать</span><span class="danger-link preview-button">Удалить карточку</span></div>
    </article>
  </Teleport>
</template>
