import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { authStore } from '../store/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { guestOnly: true }
    },
    { // link inventati 
    path: '/:pathMatch(.*)*', 
    redirect: '/' 
    }
  ]
})

router.beforeEach(async (to, from,) => {
  if (!authStore.isInitialized) {
    await authStore.checkAuth();
  }
  const isLoggato = !!authStore.utente;

  // CASO 1: La rotta richiede autenticazione ma l'utente NON è loggato
  if (to.meta.requiresAuth && !isLoggato) {
    return { name: 'home' }; 
  }

  // CASO 2: La rotta è "guestOnly" (es. Register) ma l'utente È loggato
  if (to.meta.guestOnly && isLoggato) {
    return { name: 'home' };
  }

});

export default router