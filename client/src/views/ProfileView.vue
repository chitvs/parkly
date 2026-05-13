<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../store/auth.js'
import * as bootstrap from 'bootstrap'

import Header from '../components/Header.vue' 
import Footer from '../components/Footer.vue'

// Importiamo le icone SVG per le password
import eyeUrl from '../icons/eye-open.svg'
import eyeClosedUrl from '../icons/eye-closed.svg'
import IconKey from '../icons/IconKey.vue'

//foto profilo standard
import defaultAvatarUrl from '../assets/default-avatar.png'

const router = useRouter()

// --- DATI PROFILO ---
const originalData = ref({ nome: '', cognome: '', nomeUtente: '', email: '', telefono: '', codiceFiscale: '', fotoProfilo_URL: '' })
const formData = reactive({ nome: '', cognome: '', nomeUtente: '', email: '', telefono: '', codiceFiscale: '', fotoProfilo_URL: '' })

// --- DATI CAMBIO PASSWORD ---
const pwdCurrent = ref('')
const pwdNew = ref('')
const pwdConfirm = ref('')
const modalPwdElement = ref(null)
let modalPwdInstance = null

// Variabili per mostrare/nascondere le password
const showCurrentPwd = ref(false)
const showNewPwd = ref(false)
const showConfirmPwd = ref(false)

onMounted(async () => {
  // Inizializza il Modal di Bootstrap
  if (modalPwdElement.value) {
    modalPwdInstance = new bootstrap.Modal(modalPwdElement.value)
  }

  // Caricamento Dati
  const response = await authStore.getProfile()
  if (response.success) {
    const userDb = response.data
    const datiDalServer = {
      nome: userDb.nome || '',
      cognome: userDb.cognome || '',
      nomeUtente: userDb.nomeutente || '',
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

onUnmounted(() => {
  if (modalPwdInstance) modalPwdInstance.dispose()
})

//serve per attivare tasto "salva modifiche"
const hasChanges = computed(() => {
  return formData.nome !== originalData.value.nome ||
         formData.cognome !== originalData.value.cognome ||
         formData.nomeUtente !== originalData.value.nomeUtente ||
         formData.email !== originalData.value.email ||
         formData.telefono !== originalData.value.telefono ||
         formData.codiceFiscale !== originalData.value.codiceFiscale;
})

//salvo i nuovi dati
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
    alert("Errore imprevisto.")
  }
}

//salvo la nuova foto profilo
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const data = new FormData();
  data.append('avatar', file); 

  try {
    const response = await fetch('/api/auth/upload-avatar', {
      method: 'POST', credentials: 'include', body: data 
    });
    const result = await response.json();
    if (result.success) {
      formData.fotoProfilo_URL = result.url;
      originalData.value.fotoProfilo_URL = result.url;
      if (authStore.utente) {
        authStore.utente.fotoProfilo_URL = result.url;
        localStorage.setItem('utente', JSON.stringify(authStore.utente)); 
      }
      alert("Foto profilo aggiornata!");
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert("Errore durante il caricamento dell'immagine.");
  }
}

// logica per l'eliminazione dell'account
const handleDeleteAccount = async () => {
  const confermato = window.confirm(
    "Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile e perderai l'accesso al tuo saldo residuo."
  );

  if (confermato) {
    const response = await authStore.deleteAccount();
    if (response.success) {
      alert("Account eliminato con successo. Ci dispiace vederti andare via!");
      router.push('/'); // Rimanda alla home
    } else {
      alert(response.error || "Errore durante l'eliminazione dell'account.");
    }
  }
};

// Funzione per aprire il modal del cambio password
const openPwdModal = () => {
  if (modalPwdInstance) {
    modalPwdInstance.show()
  }
}

// Forza la pulizia del DOM per rimuovere lo sfondo grigio bloccato
const forceCleanupModal = () => {
  document.body.classList.remove('modal-open')
  document.body.style = ''
  const backdrop = document.querySelector('.modal-backdrop')
  if (backdrop) backdrop.remove()
}

// Chiude il modal in modo sicuro aspettando l'animazione
const closePwdModal = () => {
  return new Promise((resolve) => {
    if (!modalPwdElement.value.classList.contains('show')) {
      resolve()
      return
    }

    modalPwdElement.value.addEventListener(
      'hidden.bs.modal',
      () => {
        forceCleanupModal()
        resolve()
      },
      { once: true }
    )

    modalPwdInstance.hide()
  })
}

// --- LOGICA CAMBIO PASSWORD ---
const submitChangePassword = async () => {
  if (pwdNew.value !== pwdConfirm.value) {
    alert("Le nuove password non corrispondono!");
    return;
  }

  const response = await authStore.changePassword(pwdCurrent.value, pwdNew.value);

  if (response.success) {
    alert("Password cambiata con successo!");
    
    // Chiudi il modal in modo sicuro
    await closePwdModal();
    
    // Pulisci i campi
    pwdCurrent.value = '';
    pwdNew.value = '';
    pwdConfirm.value = '';
  } else {
    alert(response.error || "Errore durante il cambio password.");
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
              :src="formData.fotoProfilo_URL || defaultAvatarUrl" 
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
                <label class="form-label fw-semibold">Nome Utente</label>
                <input type="text" class="form-control" v-model="formData.nomeUtente" required>
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

            <div class="d-flex justify-content-between mt-4 pt-3 border-top">
              <button 
                type="button" 
                class="btn btn-outline-secondary btn-lg px-3"
                @click="openPwdModal"
              >
                <IconKey size="20" class="me-2" />
                Cambia Password
              </button>

              <button 
                type="submit" 
                class="btn btn-primary btn-lg px-4" 
                :disabled="!hasChanges"
              >
              <i class="bi bi-floppy me-1"></i>
                Salva Modifiche
              </button>
            </div>
            
          </form>

          <div class="mt-5 border-top pt-4 text-center">
            <p class="text-muted small mb-3">
              Una volta eliminato l'account, non potrai più recuperarlo. Tutte le tue sessioni verranno chiuse e perderai l'accesso al tuo saldo residuo.
            </p>
            <button @click="handleDeleteAccount" class="btn btn-outline-danger btn-lg px-4 " style="border-radius: 12px;">
              <i class="bi bi-trash3 me-1"></i>
              Elimina Account
            </button>
          </div>

        </div>
      </div>
    </main>

    <div class="modal fade" id="modalChangePassword" ref="modalPwdElement" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content parkly-modal">
          <div class="modal-header border-0">
            <h5 class="modal-title fw-bold title-color mx-auto mt-2">Sicurezza Account</h5>
            <button type="button" class="btn-close position-absolute end-0 me-3 mt-3" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          
          <div class="modal-body px-4 pb-5">
            <p class="text-muted text-center mb-4">Inserisci la tua password attuale per poterne impostare una nuova.</p>
            
            <form @submit.prevent="submitChangePassword">
              <div class="mb-3">
                <div class="input-group password-group">
                  <input
                    :type="showCurrentPwd ? 'text' : 'password'"
                    class="form-control password-field"
                    placeholder="Password Attuale"
                    v-model="pwdCurrent"
                    required
                  />
                  <button
                    class="btn toggle-password-btn"
                    type="button"
                    @click="showCurrentPwd = !showCurrentPwd"
                    tabindex="-1"
                  >
                    <img :src="showCurrentPwd ? eyeClosedUrl : eyeUrl" class="password-icon" />
                  </button>
                </div>
              </div>
              
              <div class="mb-3 mt-4">
                <div class="input-group password-group">
                  <input
                    :type="showNewPwd ? 'text' : 'password'"
                    class="form-control password-field"
                    placeholder="Nuova Password"
                    v-model="pwdNew"
                    required
                  />
                  <button
                    class="btn toggle-password-btn"
                    type="button"
                    @click="showNewPwd = !showNewPwd"
                    tabindex="-1"
                  >
                    <img :src="showNewPwd ? eyeClosedUrl : eyeUrl" class="password-icon" />
                  </button>
                </div>
              </div>
              
              <div class="mb-4">
                <div class="input-group password-group">
                  <input
                    :type="showConfirmPwd ? 'text' : 'password'"
                    class="form-control password-field"
                    placeholder="Conferma Nuova Password"
                    v-model="pwdConfirm"
                    required
                  />
                  <button
                    class="btn toggle-password-btn"
                    type="button"
                    @click="showConfirmPwd = !showConfirmPwd"
                    tabindex="-1"
                  >
                    <img :src="showConfirmPwd ? eyeClosedUrl : eyeUrl" class="password-icon" />
                  </button>
                </div>
              </div>

              <div class="d-grid mt-4">
                <button type="submit" class="btn btn-primary modal-submit-btn">Aggiorna Password</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

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
.btn-outline-secondary { 
  border-radius: 12px; 
  height: 55px; 
  font-weight: 600; 
  font-size: 16px; 
  display: flex; 
  align-items: center;
}
.btn-outline-danger{
  border-radius: 12px;
  height: 55px; 
  font-weight: 600; 
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-outline-danger:hover { 
  color: white !important; 
}

/* --- STILI MODAL --- */
.parkly-modal { 
  border-radius: 24px; 
  border: none; 
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2); 
}
.modal-input { 
  height: 52px; 
  border-radius: 12px; 
  border: 1px solid #e0e0e0; 
  padding: 10px 18px; 
  font-size: 15px; 
}
.modal-input:focus { 
  border-color: #00408a; 
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1); outline: none; 
}
.modal-submit-btn { 
  height: 52px; 
  border-radius: 12px; 
  font-weight: 600; 
  font-size: 1.1rem; 
}

/* --- STILI PASSWORD GROUP (DA REGISTER E HEADER) --- */
.password-group {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
  background-color: #ffffff; /* Sfondo bianco per il gruppo */
}

.password-group:focus-within {
  border-color: #00408a;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.password-field {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  height: 52px;
}

.toggle-password-btn {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  align-items: center;
}

.password-icon {
  width: 20px;
  height: 20px;
}
</style>