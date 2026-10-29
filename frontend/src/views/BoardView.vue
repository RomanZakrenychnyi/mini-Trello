<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, request, type Board } from '../api';
import BoardLists from '../components/BoardLists.vue';
import BoardActions from '../components/BoardActions.vue';

const route = useRoute();
const router = useRouter();
const board = ref<Board | null>(null);
const loading = ref(true);
const error = ref('');
const missing = ref(false);
let requestId = 0;

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = '';
  missing.value = false;
  board.value = null;
  try {
    const result = await request<Board>(`/boards/${encodeURIComponent(String(route.params.id))}`);
    if (current === requestId) board.value = result;
  } catch (cause) {
    if (current !== requestId) return;
    missing.value = cause instanceof ApiError && cause.status === 404;
    error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить доску';
  } finally { if (current === requestId) loading.value = false; }
}

watch(() => route.params.id, load, { immediate: true });
</script>

<template>
  <RouterLink to="/" class="back-link">← Все доски</RouterLink>
  <p v-if="loading" class="loading-state" role="status">Загружаем доску…</p>
  <section v-else-if="error" role="alert"><h1>{{ missing ? 'Доска не найдена' : 'Не удалось открыть доску' }}</h1><p class="error">{{ error }}</p><button v-if="!missing" @click="load">Повторить</button></section>
  <template v-else-if="board">
    <div class="board-heading">
    <div class="heading"><p class="eyebrow">ДОСКА ПРОЕКТА</p><h1>{{ board.name }}</h1><p class="board-meta">Создана {{ new Date(board.createdAt).toLocaleDateString('ru-RU') }}</p></div>
    <BoardActions :key="board.id" :board="board" @updated="board = $event" @removed="router.replace('/')" />
    </div>
    <BoardLists :key="board.id" :board-id="board.id" />
  </template>
</template>
