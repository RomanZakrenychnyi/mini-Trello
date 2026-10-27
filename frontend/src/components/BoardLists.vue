<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { request, type BoardList } from '../api';
import ListColumn from './ListColumn.vue';

const props = defineProps<{ boardId: string }>();
const lists = ref<BoardList[]>([]);
const loading = ref(true);
const loadError = ref('');
const createError = ref('');
const name = ref('');
const saving = ref(false);
const path = `/boards/${encodeURIComponent(props.boardId)}/lists`;

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
    <p v-if="loading" role="status">Загружаем списки…</p>
    <div v-else-if="loadError" role="alert"><p class="error">{{ loadError }}</p><button @click="load">Повторить загрузку</button></div>
    <template v-else>
      <p v-if="lists.length === 0" class="intro">На доске пока нет списков. Добавьте первый — например, «Нужно сделать».</p>
      <div class="lists-row">
        <ListColumn v-for="list in lists" :key="list.id" :list="list" @updated="updated" @removed="lists = lists.filter((item) => item.id !== $event)" />
        <form class="list-create" @submit.prevent="create">
          <h3>Новый список</h3>
          <label for="list-name">Название списка</label>
          <input id="list-name" v-model="name" required maxlength="100" :disabled="saving" placeholder="Например, В работе" :aria-invalid="!!createError" :aria-describedby="createError ? 'list-create-error' : undefined" />
          <p v-if="createError" id="list-create-error" class="error" role="alert">{{ createError }}</p>
          <button :disabled="saving">{{ saving ? 'Добавляем…' : 'Добавить список' }}</button>
        </form>
      </div>
    </template>
  </section>
</template>
