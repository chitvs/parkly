<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { authStore } from '../store/auth.js'

// 1. IMPORTA HEADER E FOOTER (Assicurati che il percorso sia corretto)

import Header from '../components/Header.vue' 
import Footer from '../components/Footer.vue'

const originalData = ref({
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  codiceFiscale: ''
})

const formData = reactive({
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  codiceFiscale: ''
})

onMounted(async () => {
  // Richiamiamo il backend per avere i dati veri
  const response = await authStore.getProfile()

  if (response.success) {
    // Backend ha risposto con successo, prendiamo i dati
    const userDb = response.data
    
    const datiDalServer = {
      nome: userDb.nome || '',
      cognome: userDb.cognome || '',
      email: userDb.email || '',
      telefono: userDb.telefono || '',
      codiceFiscale: userDb.codicefiscale || '' // occhio a come Postgres formatta le chiavi (spesso in minuscolo)
    }
    
    // Riempiamo i campi modificabili
    originalData.value = { ...datiDalServer }
    Object.assign(formData, datiDalServer)
  } else {
    // Se fallisce (es. sessione scaduta), potresti reindirizzare al login
    alert(response.error || "Impossibile caricare il profilo")
  }
})

const hasChanges = computed(() => {
  return formData.nome !== originalData.value.nome ||
         formData.cognome !== originalData.value.cognome ||
         formData.email !== originalData.value.email ||
         formData.telefono !== originalData.value.telefono ||
         formData.codiceFiscale !== originalData.value.codiceFiscale;
})

const handleSave = async () => {
  if (!hasChanges.value) return

  try {
    console.log("Dati da salvare:", formData)
    originalData.value = { ...formData }
    alert("Modifiche salvate con successo!")
  } catch (error) {
    alert("Errore durante il salvataggio dei dati.")
  }
}
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <main class="container py-5 flex-grow-1">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-6">
          
          <h2 class="fw-bold mb-1 title-color">Il tuo Profilo</h2>
          <p class="text-muted mb-4">Modifica le tue informazioni personali</p>

          <form @submit.prevent="handleSave">
            
            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label fw-semibold">Nome</label>
                <input type="text" class="form-control" v-model="formData.nome" required>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Cognome</label>
                <input type="text" class="form-control" v-model="formData.cognome" required>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold">Indirizzo Email</label>
              <input type="email" class="form-control" v-model="formData.email" required>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold">Codice Fiscale</label>
              <input type="text" class="form-control text-uppercase" v-model="formData.codiceFiscale">
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold">Telefono</label>
              <input type="tel" class="form-control" v-model="formData.telefono">
            </div>

            <div class="d-flex justify-content-end mt-4">
              <button 
                type="submit" 
                class="btn btn-primary btn-lg px-4" 
                :disabled="!hasChanges"
              >
                Salva Modifiche
              </button>
            </div>
            
          </form>

        </div>
      </div>
    </main>

    <Footer />
  </div>
</template>

<style scoped>
/* Aggiungiamo un wrapper per spingere il footer in fondo alla pagina se il contenuto è poco */
.page-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.title-color {
  color: var(--primary-blue, #00408A);
  letter-spacing: -0.5px;
}

.form-label {
  font-size: 14px;
  color: #495057;
  margin-bottom: 6px;
}

.form-control {
  height: 52px;
  border-radius: 12px;
  border: 1px solid #E0E0E0;
  padding: 10px 18px;
  font-size: 15px;
  transition: all 0.2s ease;
  background-color: #fafafa;
}

.form-control:focus {
  border-color: var(--primary-blue, #00408A);
  box-shadow: 0 0 0 4px rgba(0, 64, 138, 0.1);
  outline: none;
  background-color: #ffffff;
}

.btn-primary {
  background-color: var(--primary-blue, #00408A);
  border: none;
  border-radius: 12px;
  height: 55px;
  font-weight: 600;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #00336E;
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.7;
}
</style>