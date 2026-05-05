import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { authStore } from '../store/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/prenotazioni',
      name: 'prenotazioni',
      component: () => import('../views/BookingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/portafoglio',
      name: 'portafoglio',
      component: () => import('../views/WalletView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/garage',
      name: 'garage',
      component: () => import('../views/GarageView.vue'),
    },
    {
      path: '/garage/:id',
      name: 'garage-detail',
      component: () => import('../views/GarageDetailView.vue'),
      props: true, 
    },
    {
      path: '/dashboard-gestore',
      name: 'dashboard-gestore',
      component: () => import('../views/GestoreDashboardView.vue'),
      // solo chi è loggato ed è un gestore
      meta: { requiresAuth: true, role: 'GESTORE' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to, from) => {
  if (!authStore.isInitialized) {
    await authStore.checkAuth()
  }
  const isLoggato = !!authStore.utente
  const ruoloUtente = authStore.utente?.ruolo

  // CASO 1: La rotta richiede autenticazione ma l'utente NON è loggato
  if (to.meta.requiresAuth && !isLoggato) {
    return { name: 'home' }
  }

  // CASO 2: La rotta richiede un ruolo specifico (es. GESTORE)
  if (to.meta.role && ruoloUtente !== to.meta.role) {
    console.warn("Accesso negato: ruolo non autorizzato")
    return { name: 'home' }
  }

  // CASO 3: La rotta è "guestOnly" (es. Register) ma l'utente È loggato
  if (to.meta.guestOnly && isLoggato) {
    return { name: 'home' }
  }
})

export default router