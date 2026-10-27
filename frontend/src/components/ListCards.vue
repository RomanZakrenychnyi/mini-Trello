<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { request, type Card } from '../api';
import CardForm from './CardForm.vue';
import CardItem from './CardItem.vue';

const props = defineProps<{ boardId: string; listId: string }>();
const emit = defineEmits<{ count: [count: number | null] }>();
const cards = ref<Card[]>([]);
const loading = ref(true);
const loadError = ref('');
const createError = ref('');
const adding = ref(false);
const busy = ref(false);
const path = `/boards/${encodeURIComponent(props.boardId)}/lists/${encodeURIComponent(props.listId)}/cards`;
async function load() {
  loading.value = true;
  loadError.value = '';
  emit('count', null);
  try { cards.value = await request<Card[]>(path); emit('count', cards.value.length); }
  catch (cause) { loadError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить карточки'; }
  finally { loading.value = false; }
}
async function create(data: { title: string; description: string }) {
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
  <div class="list-cards" :aria-busy="loading">
    <p v-if="loading" role="status">Загружаем карточки…</p>
    <div v-else-if="loadError" role="alert"><p class="error">{{ loadError }}</p><button class="secondary" @click="load">Повторить</button></div>
    <template v-else>
      <p v-if="cards.length === 0" class="list-placeholder">Пока нет карточек</p>
      <CardItem v-for="card in cards" :key="card.id" :card="card" :path="path" @updated="update" @removed="remove" />
      <CardForm v-if="adding" :id="`new-${listId}`" :busy="busy" submit-label="Создать карточку" @save="create" @cancel="adding = false; createError = ''" />
      <button v-else class="add-card secondary" @click="adding = true; createError = ''">+ Добавить карточку</button>
      <p v-if="createError" role="alert" class="error">{{ createError }}</p>
    </template>
  </div>
</template>
