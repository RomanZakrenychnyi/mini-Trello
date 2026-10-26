import { createRouter, createWebHistory } from 'vue-router';
import BoardsView from './views/BoardsView.vue';
import BoardView from './views/BoardView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: BoardsView },
    { path: '/boards/:id', component: BoardView },
    { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue') },
  ],
});
