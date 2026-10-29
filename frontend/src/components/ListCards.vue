<script setup lang="ts">
import { computed, inject, onMounted, ref, watch, watchEffect, onBeforeUnmount } from 'vue';
import { boardSearch } from '../boardSearch';
import { cardMovement } from '../cardMovement';
import { request, type Card, type CardInput } from '../api';
import CardForm from './CardForm.vue';
import CardItem from './CardItem.vue';

const props = defineProps<{ boardId: string; listId: string }>();
const emit = defineEmits<{ count: [count: number | null] }>();
const cards = ref<Card[]>([]);
const loading = ref(true);
let loaded = false;
const loadError = ref('');
const createError = ref('');
const adding = ref(false);
const busy = ref(false);
const movement = inject(cardMovement)!;
const search = inject(boardSearch)!;
const needle = computed(() => search.query.value.trim().toLocaleLowerCase());
function matches(card: Card) {
  const textMatches = !needle.value || card.title.toLocaleLowerCase().includes(needle.value) || card.description.toLocaleLowerCase().includes(needle.value);
  const statusMatches = search.filter.value === 'all' ||
    (search.filter.value === 'pending' && !card.completed) ||
    (search.filter.value === 'completed' && card.completed) ||
    (search.filter.value === 'overdue' && !card.completed && !!card.dueDate && card.dueDate < search.today.value);
  return textMatches && statusMatches;
}
const matchedCount = computed(() => cards.value.filter(matches).length);
watchEffect(() => search.report(props.listId, loading.value ? null : { count: loadError.value ? 0 : matchedCount.value, failed: !!loadError.value }));
onBeforeUnmount(() => search.report(props.listId, null));
watch(movement.revision, load);
function active(index: number) { return movement.target.value?.listId === props.listId && movement.target.value.index === index; }
const path = `/boards/${encodeURIComponent(props.boardId)}/lists/${encodeURIComponent(props.listId)}/cards`;
async function load() {
  loading.value = !loaded;
  loadError.value = '';
  emit('count', null);
  try { cards.value = await request<Card[]>(path); emit('count', cards.value.length); }
  catch (cause) { loadError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить карточки'; }
  finally { loading.value = false; loaded = true; }
}
async function create(data: CardInput) {
  if (busy.value) return;
  busy.value = true;
  createError.value = '';
  try {
    const card = await request<Card>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    cards.value.push(card);
    cards.value.sort((a, b) => a.position - b.position);
    emit('count', cards.value.length);
    adding.value = false;
  } catch (cause) { createError.value = cause instanceof Error ? cause.message : 'Не удалось создать карточку'; }
  finally { busy.value = false; }
}
function update(card: Card) { cards.value = cards.value.map((item) => item.id === card.id ? card : item); }
function remove(id: string) { cards.value = cards.value.filter((item) => item.id !== id); emit('count', cards.value.length); }
onMounted(load);
</script>

<template>
  <div class="list-cards" :aria-busy="loading" :data-drop-list="!loading && !loadError && !movement.searchActive.value ? listId : undefined" :data-drop-index="cards.length">
    <p v-if="loading" class="loading-state" role="status">Загружаем карточки…</p>
    <div v-else-if="loadError" role="alert"><p class="error">{{ loadError }}</p><button class="secondary" @click="load">Повторить</button></div>
    <template v-else>
      <p v-if="movement.searchActive.value && matchedCount === 0" class="list-placeholder">Нет совпадений в этом списке</p>
      <p v-else-if="cards.length === 0" class="list-placeholder">Пока нет карточек</p>
      <TransitionGroup name="card-order" tag="div">
      <div v-for="(card, index) in cards" v-show="matches(card)" :key="card.id">
        <div v-if="movement.dragged.value" class="card-drop" :class="{ 'drop-active': active(index) }" :data-drop-list="listId" :data-drop-index="index">Поместить сюда</div>
        <CardItem :card="card" :path="path" :index="index" :total="cards.length" @updated="update" @removed="remove" />
      </div>
      </TransitionGroup>
      <div v-if="movement.dragged.value" class="card-drop" :class="{ 'drop-active': active(cards.length) }" :data-drop-list="listId" :data-drop-index="cards.length">Поместить в конец</div>
      <CardForm v-if="adding" :id="`new-${listId}`" :busy="busy" submit-label="Создать карточку" @save="create" @cancel="adding = false; createError = ''" />
      <button v-else class="add-card secondary" @click="adding = true; createError = ''">+ Добавить карточку</button>
      <p v-if="createError" role="alert" class="error">{{ createError }}</p>
    </template>
  </div>
</template>
