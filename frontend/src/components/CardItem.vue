<script setup lang="ts">
import { ref } from 'vue';
import { request, type Card } from '../api';
import CardForm from './CardForm.vue';

const props = defineProps<{ card: Card; path: string }>();
const emit = defineEmits<{ updated: [card: Card]; removed: [id: string] }>();
const editing = ref(false);
const confirming = ref(false);
const busy = ref(false);
const error = ref('');
function cancel() { editing.value = false; confirming.value = false; error.value = ''; }
async function save(data: { title: string; description: string }) {
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
  <article class="task-card" :aria-label="`Карточка ${card.title}`" :aria-busy="busy">
    <CardForm v-if="editing" :id="card.id" :initial-title="card.title" :initial-description="card.description" :busy="busy" submit-label="Сохранить карточку" @save="save" @cancel="cancel" />
    <template v-else>
      <h4>{{ card.title }}</h4>
      <p v-if="card.description" class="card-description">{{ card.description }}</p>
      <div v-if="confirming"><p>Удалить карточку «{{ card.title }}»?</p><div class="list-actions"><button class="danger" :disabled="busy" @click="remove">{{ busy ? 'Удаляем…' : 'Да, удалить карточку' }}</button><button class="secondary" :disabled="busy" @click="cancel">Отмена</button></div></div>
      <div v-else class="list-actions"><button class="secondary" @click="editing = true; error = ''">Редактировать</button><button class="danger-link" @click="confirming = true; error = ''">Удалить карточку</button></div>
    </template>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </article>
</template>
