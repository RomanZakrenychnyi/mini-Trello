<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { request, type Board } from '../api';

const router = useRouter();
const boards = ref<Board[]>([]);
const loading = ref(true);
const loadError = ref('');
const createError = ref('');
const name = ref('');
const saving = ref(false);

async function load() {
  loading.value = true;
  loadError.value = '';
  try { boards.value = await request<Board[]>('/boards'); }
  catch (error) { loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить доски'; }
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
    const board = await request<Board>('/boards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }),
    });
    await router.push(`/boards/${board.id}`);
  } catch (error) { createError.value = error instanceof Error ? error.message : 'Не удалось создать доску'; }
  finally { saving.value = false; }
}

onMounted(load);
</script>

<template>
  <div class="heading"><p class="eyebrow">ОТ ИДЕИ К РЕЗУЛЬТАТУ</p><h1>Мои доски</h1><p class="intro">Создайте пространство для следующего проекта.</p></div>
  <section class="create-panel" aria-labelledby="create-title">
    <h2 id="create-title">Новая доска</h2>
    <form @submit.prevent="create">
      <label for="board-name">Название доски</label>
      <div class="form-row"><input id="board-name" v-model="name" maxlength="100" required :disabled="saving" placeholder="Например, запуск проекта" :aria-invalid="!!createError" :aria-describedby="createError ? 'create-error' : undefined" /><button :disabled="saving">{{ saving ? 'Создаём…' : 'Создать доску' }}</button></div>
      <p v-if="createError" id="create-error" class="error" role="alert">{{ createError }}</p>
    </form>
  </section>
  <section aria-labelledby="boards-title" :aria-busy="loading">
    <h2 id="boards-title">Ваши доски <span v-if="!loading && !loadError" class="count">{{ boards.length }}</span></h2>
    <p v-if="loading" class="loading-state" role="status">Загружаем доски…</p>
    <div v-else-if="loadError" role="alert"><p class="error">{{ loadError }}</p><button class="secondary" @click="load">Повторить загрузку</button></div>
    <div v-else-if="boards.length === 0" class="empty"><h3>Здесь начнётся ваш следующий проект</h3><p>Создайте первую доску с помощью формы выше.</p></div>
    <div v-else class="board-grid">
      <RouterLink v-for="board in boards" :key="board.id" :to="`/boards/${board.id}`" class="board-card">
        <div class="board-cover" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="board-card-body"><h3>{{ board.name }}</h3><p class="board-meta">Создана {{ new Date(board.createdAt).toLocaleDateString('ru-RU') }}</p><span class="board-card-link">Открыть доску <span aria-hidden="true">↗</span></span></div>
      </RouterLink>
    </div>
  </section>
</template>
