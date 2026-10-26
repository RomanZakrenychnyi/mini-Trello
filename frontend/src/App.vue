<script setup lang="ts">
import { onMounted, ref } from 'vue';

const status = ref('Проверяем соединение…');
const checking = ref(false);

async function checkHealth() {
  checking.value = true;
  status.value = 'Проверяем соединение…';
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Health request failed');
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
      throw new Error('Unexpected health response');
    }
    status.value = 'Сервер доступен';
  } catch {
    status.value = 'Сервер недоступен. Проверьте, запущен ли backend.';
  } finally {
    checking.value = false;
  }
}

onMounted(checkHealth);
</script>

<template>
  <main>
    <p class="eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</p>
    <h1>mini-Trello</h1>
    <p class="intro">Здесь появятся ваши доски, списки и карточки задач.</p>
    <section aria-labelledby="status-title">
      <h2 id="status-title">Соединение с сервером</h2>
      <p role="status" aria-live="polite">{{ status }}</p>
      <button :disabled="checking" @click="checkHealth">Проверить снова</button>
    </section>
  </main>
</template>
