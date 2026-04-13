import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GestoreDashboardView from '../../../client/GestoreDashboardView.vue'

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
      component: () => import('../views/RegisterView.vue')
    },
    {
      path: '/dashboard-gestore',
      name: 'dashboard-gestore',
      component: () => import('../../../client/GestoreDashboardView.vue')
    }
  ]
})

export default router