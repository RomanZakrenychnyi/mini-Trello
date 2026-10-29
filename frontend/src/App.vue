<template>
  <header class="topbar">
    <RouterLink to="/" class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>mini-Trello</RouterLink>
    <span class="workspace-label"><span class="workspace-dot" aria-hidden="true"></span>Ваше рабочее пространство</span>
  </header>
  <main :class="{ 'board-page': !!$route.params.id }"><RouterView /></main>
</template>
