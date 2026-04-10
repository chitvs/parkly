<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { authStore } from '../store/auth.js'

// Importo Header e Footer (OCCHIO AI PERCORSI)
import Header from '../components/Header.vue' 
import Footer from '../components/Footer.vue'

// Dati originali per il confronto
const originalData = ref({
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  codiceFiscale: '',
  fotoProfilo_URL: ''
})

// Dati reattivi collegati agli input del form
const formData = reactive({
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  codiceFiscale: '',
  fotoProfilo_URL: ''
})

// Caricamento dati all'apertura della pagina
onMounted(async () => {
  const response = await authStore.getProfile()

  if (response.success) {
    const userDb = response.data
    
    const datiDalServer = {
      nome: userDb.nome || '',
      cognome: userDb.cognome || '',
      email: userDb.email || '',
      telefono: userDb.telefono || '',
      codiceFiscale: userDb.codicefiscale || '', 
      fotoProfilo_URL: userDb.fotoprofilo_url || '' 
    }
    
    originalData.value = { ...datiDalServer }
    Object.assign(formData, datiDalServer)
  } else {
    alert(response.error || "Impossibile caricare il profilo")
  }
})

// Controllo per abilitare/disabilitare il tasto "Salva"
const hasChanges = computed(() => {
  return formData.nome !== originalData.value.nome ||
         formData.cognome !== originalData.value.cognome ||
         formData.email !== originalData.value.email ||
         formData.telefono !== originalData.value.telefono ||
         formData.codiceFiscale !== originalData.value.codiceFiscale;
})

// Salvataggio dei dati testuali
const handleSave = async () => {
  if (!hasChanges.value) return 

  try {
    const response = await authStore.updateProfile(formData)
    
    if (response.success) {
      originalData.value = { ...formData }
      alert("Modifiche salvate con successo!")
    } else {
      alert(response.error || "Errore durante il salvataggio dei dati.")
    }
  } catch (error) {
    alert("Errore imprevisto durante la comunicazione col server.")
  }
}

// Upload della foto profilo
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const data = new FormData();
  data.append('avatar', file); 

  try {
    const response = await fetch('/api/auth/upload-avatar', {
      method: 'POST',
      credentials: 'include', 
      body: data 
    });

    const result = await response.json();
    
    if (result.success) {
      formData.fotoProfilo_URL = result.url;
      originalData.value.fotoProfilo_URL = result.url;

      if (authStore.utente) {
        authStore.utente.fotoProfilo_URL = result.url;
        // Per sicurezza salviamo l'aggiornamento nel localStorage
        localStorage.setItem('utente', JSON.stringify(authStore.utente)); 
    }

      alert("Foto profilo aggiornata!");
    } else {
      alert(result.error);
    }
  } catch (err) {
    console.error(err);
    alert("Errore durante il caricamento dell'immagine.");
  }
}
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <main class="container py-5 flex-grow-1">
      <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-6">
          
          <h2 class="fw-bold mb-1 title-color text-center">Il tuo Profilo</h2>
          <p class="text-muted mb-4 text-center">Modifica le tue informazioni personali</p>

          <div class="text-center mb-4 pb-3 border-bottom">
            <img 
              :src="formData.fotoProfilo_URL || '/default-avatar.png'" 
              alt="Foto Profilo" 
              class="rounded-circle mb-3 shadow-sm" 
              style="width: 120px; height: 120px; object-fit: cover; border: 3px solid var(--primary-blue, #00408A);"
              >
            <div>
              <label class="form-label fw-semibold mb-2">Cambia foto profilo</label>
              <input type="file" @change="handleFileUpload" accept="image/*" class="form-control form-control-sm w-75 mx-auto">
            </div>
          </div>

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

/* Fix per l'input di tipo file che è più piccolo */
input[type="file"].form-control-sm {
  height: auto;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 8px;
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