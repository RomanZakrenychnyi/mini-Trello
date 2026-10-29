<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { request, type ChecklistItem } from '../api';

const props = defineProps<{ cardId: string; path: string; disabled: boolean }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const items = ref<ChecklistItem[]>([]);
const loading = ref(true);
const loadError = ref('');
const error = ref('');
const saving = ref(false);
const title = ref('');
const editing = ref<string | null>(null);
const editTitle = ref('');
const confirming = ref<string | null>(null);
const expanded = ref(false);
const completedCount = computed(() => items.value.filter(item => item.completed).length);
let generation = 0;

async function load() {
  const current = ++generation;
  loading.value = true;
  loadError.value = '';
  error.value = '';
  items.value = [];
  editing.value = null;
  confirming.value = null;
  title.value = '';
  try {
    const result = await request<ChecklistItem[]>(`${props.path}/checklist`);
    if (current === generation) items.value = result;
  } catch (cause) {
    if (current === generation) loadError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить чек-лист';
  } finally { if (current === generation) loading.value = false; }
}
function validTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) { error.value = 'Название пункта должно содержать от 1 до 200 символов'; return null; }
  return trimmed;
}
async function mutate(action: () => Promise<void>) {
  if (saving.value || props.disabled) return;
  saving.value = true;
  emit('busy', true);
  error.value = '';
  try { await action(); }
  catch (cause) { expanded.value = true; error.value = cause instanceof Error ? cause.message : 'Не удалось изменить чек-лист'; }
  finally { saving.value = false; emit('busy', false); }
}
async function create() {
  const name = validTitle(title.value);
  if (name === null) return;
  await mutate(async () => {
    const item = await request<ChecklistItem>(`${props.path}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: name }) });
    items.value.push(item);
    items.value.sort((a, b) => a.position - b.position);
    title.value = '';
  });
}
async function update(item: ChecklistItem, data: { title?: string; completed?: boolean }) {
  const wasEditing = editing.value === item.id;
  await mutate(async () => {
    const result = await request<ChecklistItem>(`${props.path}/checklist/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    items.value = items.value.map(entry => entry.id === item.id ? result : entry);
    if (editing.value === item.id) {
      editing.value = null;
    }
  });
  if (wasEditing && editing.value === null) {
    await nextTick();
    document.getElementById(`checklist-rename-${item.id}`)?.focus();
  }
}
function toggle(item: ChecklistItem, event: Event) {
  (event.target as HTMLInputElement).checked = item.completed;
  void update(item, { completed: !item.completed });
}
function rename(item: ChecklistItem) {
  const name = validTitle(editTitle.value);
  if (name !== null) void update(item, { title: name });
}
async function beginEdit(item: ChecklistItem) {
  editing.value = item.id;
  editTitle.value = item.title;
  confirming.value = null;
  error.value = '';
  await nextTick();
  const input = document.getElementById(`checklist-edit-${item.id}`) as HTMLInputElement | null;
  input?.focus();
  input?.select();
}
async function cancelItem(id: string, deleting = false) {
  if (saving.value) return;
  editing.value = null; confirming.value = null; error.value = '';
  await nextTick();
  document.getElementById(`checklist-${deleting ? 'delete' : 'rename'}-${id}`)?.focus();
}
async function confirmItem(item: ChecklistItem) {
  confirming.value = item.id; error.value = '';
  await nextTick();
  document.getElementById(`checklist-confirm-${item.id}`)?.focus();
}
async function remove(item: ChecklistItem) {
  await mutate(async () => {
    await request(`${props.path}/checklist/${item.id}`, { method: 'DELETE' });
    items.value = items.value.filter(entry => entry.id !== item.id);
    confirming.value = null;
  });
}
watch(() => props.path, load, { immediate: true });
onBeforeUnmount(() => { generation++; emit('busy', false); });
</script>

<template>
  <section class="card-checklist" :aria-labelledby="`checklist-${cardId}`" :aria-busy="loading || saving">
    <h5 :id="`checklist-${cardId}`">
      <button class="checklist-disclosure" type="button" :aria-expanded="expanded" :aria-controls="`checklist-content-${cardId}`" @click="expanded = !expanded">
        <span>☑ Чек-лист</span><span v-if="!loading && !loadError" class="checklist-count">{{ completedCount }} из {{ items.length }}</span><span class="disclosure-chevron" aria-hidden="true">{{ expanded ? '⌃' : '⌄' }}</span>
      </button>
    </h5>
    <p v-if="loading" class="loading-state" role="status">Загружаем пункты…</p>
    <div v-else-if="loadError"><p class="error" role="alert">{{ loadError }}</p><button class="secondary" :disabled="disabled" @click="load">Повторить загрузку чек-листа</button></div>
    <template v-else>
      <p class="visually-hidden" role="status">{{ completedCount }} из {{ items.length }} выполнено</p>
      <progress v-if="items.length" :value="completedCount" :max="items.length" aria-label="Прогресс чек-листа" />
      <div v-show="expanded" :id="`checklist-content-${cardId}`" class="checklist-content">
      <p v-if="items.length === 0" class="list-hint">Разбейте задачу на небольшие шаги.</p>
      <fieldset class="checklist-fields" :disabled="disabled || saving">
        <ul class="checklist-items">
          <li v-for="item in items" :key="item.id" class="checklist-item">
            <form v-if="editing === item.id" @submit.prevent="rename(item)" @keydown.esc.stop.prevent="cancelItem(item.id)">
              <label :for="`checklist-edit-${item.id}`">Название пункта</label>
              <input :id="`checklist-edit-${item.id}`" v-model="editTitle" required maxlength="200" />
              <div class="list-actions"><button>Сохранить пункт</button><button type="button" class="secondary" @click="cancelItem(item.id)">Отмена</button></div>
            </form>
            <template v-else>
              <label class="checklist-label" :class="{ 'checklist-done': item.completed }">
                <input type="checkbox" :checked="item.completed" @change="toggle(item, $event)" />
                <span>{{ item.title }}</span>
              </label>
              <div v-if="confirming === item.id" class="checklist-confirm" @keydown.esc.stop.prevent="cancelItem(item.id, true)">
                <p :id="`checklist-confirm-${item.id}`" tabindex="-1">Удалить пункт «{{ item.title }}»?</p>
                <button class="danger" @click="remove(item)">Да, удалить пункт</button>
                <button class="secondary" @click="cancelItem(item.id, true)">Отмена</button>
              </div>
              <div v-else class="checklist-actions">
                <button :id="`checklist-rename-${item.id}`" class="secondary" :aria-label="`Переименовать пункт ${item.title}`" @click="beginEdit(item)">Изменить</button>
                <button :id="`checklist-delete-${item.id}`" class="danger-link" :aria-label="`Удалить пункт ${item.title}`" @click="confirmItem(item)">Удалить</button>
              </div>
            </template>
          </li>
        </ul>
        <form class="checklist-create" @submit.prevent="create">
          <label :for="`checklist-new-${cardId}`">Новый пункт</label>
          <input :id="`checklist-new-${cardId}`" v-model="title" required maxlength="200" placeholder="Например, согласовать макет" />
          <button class="secondary">Добавить пункт</button>
        </form>
      </fieldset>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div>
    </template>
  </section>
</template>
