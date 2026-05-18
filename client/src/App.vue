<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { authStore } from './store/auth'
import { alertStore } from './store/alert'

onMounted(async () => {
  // questa funzione controlla se esiste una sessione attiva sul server
  // e popola authStore.utente col saldo, nome, ecc.
  await authStore.checkAuth()
})
</script>

<template>
  <RouterView v-if="authStore.isInitialized" />
  
  <div v-else class="app-loader">
    Caricamento sessione...
  </div>

  <!-- Alert Globale Centralizzato -->
  <div v-if="alertStore.messaggio" :class="['alert', alertStore.messaggio.tipo, 'alert-fixed-bottom']">
      {{ alertStore.messaggio.testo }}
      <button @click="alertStore.pulisci()" class="close-btn">x</button>
  </div>
</template>

<style>
.app-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: sans-serif;
  color: #00408A;
}
</style>