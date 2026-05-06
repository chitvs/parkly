<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { authStore } from './store/auth'

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