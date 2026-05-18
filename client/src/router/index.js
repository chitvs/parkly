/**
* Questo file gestisce la navigazione e il routing per tutto il sito.
* FUNZIONALITÀ PRINCIPALI:
 * 1. Mappatura delle Rotte: Associa gli URL ai rispettivi componenti Vue.
 * 2. Lazy Loading: Utilizza l'importazione dinamica `() => import(...)` per 
 * la maggior parte delle rotte, caricando i componenti solo quando richiesti 
 * per ottimizzare i tempi di caricamento (Performance).
 * 3. Gestione Errori: Cattura le rotte inesistenti e reindirizza alla pagina 404.
 * 4. Scroll Behavior: Assicura che la visualizzazione torni in cima alla pagina 
 * dopo ogni navigazione (salvo l'uso dei tasti avanti/indietro del browser).
 * * SICUREZZA E CONTROLLO ACCESSI:
 * Il `router.beforeEach` intercetta ogni navigazione per applicare le regole 
 * basate sui "meta" tag delle rotte e sullo stato di `authStore`:
 * - `requiresAuth`: Impedisce l'accesso a utenti non loggati (es. Profilo, Prenotazioni).
 * - `role`: Limita l'accesso in base al ruolo dell'utente (CLIENTE o GESTORE).
 * - `guestOnly`: Impedisce a utenti già loggati di accedere a pagine come la Registrazione.
*/

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
      path: '/diventa-gestore',
      name: 'diventa-gestore',
      component: () => import('../views/BecomeGestoreView.vue'),
      meta: { requiresAuth: true, role: 'CLIENTE' }
    },
    {
      path: '/dashboard-gestore',
      name: 'dashboard-gestore',
      component: () => import('../views/GestoreDashboardView.vue'),
      meta: { requiresAuth: true, role: 'GESTORE' }
    },
    {
      path: '/404',
      name: 'NotFound',
      component: () => import('../views/NotFoundView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
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