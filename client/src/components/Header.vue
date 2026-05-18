<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as bootstrap from 'bootstrap'
import logoUrl from '../assets/LogoParklyBlu.svg'
import logoInteroUrl from '../assets/LogoParklyIntero.svg'
import { authStore } from '../store/auth.js' // Importa lo store auth
import { alertStore } from '../store/alert.js' // Importiamo lo store globale degli alert

//foto profilo standard
import defaultAvatarUrl from '../assets/default-avatar.png'

// IMPORT DEI COMPONENTI SVG
import IconGestore from '../icons/IconGestore.vue'
import IconHistory from '../icons/IconHistory.vue'
import IconUser from '../icons/IconUser.vue'
import IconWallet from '../icons/IconWallet.vue'
import IconLogout from '../icons/IconLogout.vue'
import IconGarage from '../icons/IconGarage.vue'

import eyeUrl from '../icons/eye-open.svg'
import eyeClosedUrl from '../icons/eye-closed.svg'

const router = useRouter()
const route = useRoute()

// Calcola se l'utente si trova attualmente nella pagina di registrazione
const isRegisterPage = computed(() => route.path === '/register')

const loginIdentificatore = ref('')
const loginPassword = ref('')
const loginError = ref('')
const isMenuOpen = ref(false)
const isPasswordVisible = ref(false)

/**
 * Ascolta i cambiamenti nei campi del form di login.
 * Se l'utente cancella la password o svuota tutto, resetta l'eventuale messaggio di errore precedente.
 */
watch([loginIdentificatore, loginPassword], ([newId, newPwd]) => {
  if ((newId === '' && newPwd === '') || newPwd === '') {
    loginError.value = ''
  }
})

const modalElement = ref(null)
let modalInstance = null


//Quando il componente viene montato nel DOM, inizializza l'istanza della Modale di Bootstraplegandola all'elemento HTML referenziato da `modalElement`.
onMounted(() => {
  modalInstance = new bootstrap.Modal(modalElement.value)
})

//Pulisce l'istanza della modale quando l'header viene distrutto, evitando memory leak.
onUnmounted(() => {
  if (modalInstance) {
    modalInstance.dispose()
  }
})


//Mostra visivamente la modale di login.
const openLoginModal = () => {
  if (modalInstance) {
    modalInstance.show()
  }
}

/**
 * Chiude la modale di login e aspetta che l'animazione di Bootstrap finisca.
 * @returns {Promise} Una promise che si risolve quando la modale è completamente nascosta.
 */
const closeLoginModal = () => {
  return new Promise((resolve) => {
    // Se la modale non esiste o non è aperta, risolve subito
    if (!modalInstance || !modalElement.value.classList.contains('show')) {
      resolve()
      return
    }

    // Aggiunge un listener (che scatta una sola volta) per l'evento di chiusura di Bootstrap
    modalElement.value.addEventListener(
      'hidden.bs.modal',
      () => {
        // Pulisce i campi del form al termine della chiusura
        loginIdentificatore.value = ''
        loginPassword.value = ''
        loginError.value = ''
        isPasswordVisible.value = false

        resolve()
      },
      { once: true }
    )

    // Avvia l'animazione di chiusura
    modalInstance.hide()
  })
}

//Gestisce il tentativo di login chiamando lo store di autenticazione.
const handleLogin = async () => {
  loginError.value = ''
  const data = await authStore.login(loginIdentificatore.value, loginPassword.value)

  if (data.success) {
    await closeLoginModal()
    // Notifica all'utente l'accesso avvenuto con successo
    alertStore.mostra('success', `Benvenuto su Parkly, ${authStore.utente?.nome}!`)
  } else {
    // Mostra l'errore ricevuto dal server (es. "Credenziali errate")
    loginError.value = data.error || 'Credenziali non valide'
  }
}

//Chiude la modale di login e reindirizza alla pagina di registrazione.
const goToRegister = async () => {
  await closeLoginModal()
  router.push('/register')
}


//Effettua il logout utente svuotando lo store e reindirizzando alla home.
const handleLogout = async () => {
  await authStore.logout()
  alertStore.mostra('success', 'Ti sei disconnesso correttamente. Arrivederci!')
  router.replace('/')
}
</script>

<template>
  <header class="main-header">
    <RouterLink to="/" class="logo-link">
      <div class="logo">
        <img :src="logoInteroUrl" alt="Logo Parkly" class="logo-image" />
      </div>
    </RouterLink>

    <div class="right-section" v-if="!isRegisterPage">

      <RouterLink to="/garage" class="nav-item">
        Trova un garage
      </RouterLink>

      <div class="user-actions">
        <template v-if="!authStore.utente">
          <div class="auth-buttons-group">
            <RouterLink to="/register" class="register-btn">Registrati</RouterLink>
            <button type="button" class="login-btn" @click="openLoginModal">
              Accedi
            </button>
          </div>
        </template>

        <div v-else class="logged-user-zone position-relative" @mouseenter="isMenuOpen = true"
          @mouseleave="isMenuOpen = false">

          <button class="btn user-name-btn d-flex align-items-center gap-2">
            <img :src="authStore.utente?.fotoProfilo_URL || defaultAvatarUrl" alt="Avatar" class="rounded-circle border"
              style="width: 30px; height: 30px; object-fit: cover; border-color: #dee2e6;" />
            <span>Ciao, <strong>{{ authStore.utente.nome }}</strong></span>
          </button>

          <ul v-if="isMenuOpen" class="dropdown-menu show shadow border-0 parkly-dropdown"
            style="position: absolute; right: 0; top: 100%">
            <template v-if="authStore.utente?.ruolo === 'GESTORE'">
              <li>
                <RouterLink class="dropdown-item fw-bold text-primary d-flex align-items-center" to="/dashboard-gestore"
                  @click="isMenuOpen = false">
                  <IconGestore class="me-2" width="20" height="20" />
                  Area Gestore
                </RouterLink>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
            </template>

            <template v-else-if="authStore.utente?.ruolo === 'CLIENTE'">
              <li>
                <RouterLink class="dropdown-item fw-bold text-primary" to="/diventa-gestore"
                  @click="isMenuOpen = false">
                  <IconGarage class="me-2" width="19" height="19" />
                  Diventa Gestore
                </RouterLink>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
            </template>

            <li>
              <RouterLink class="dropdown-item d-flex align-items-center" to="/prenotazioni"
                @click="isMenuOpen = false">
                <IconHistory class="me-2" width="17" height="17" />
                Le Tue Prenotazioni
              </RouterLink>
            </li>
            <li>
              <RouterLink class="dropdown-item d-flex align-items-center" to="/profile" @click="isMenuOpen = false">
                <IconUser class="me-2" width="18" height="18" />
                I Tuoi Dati
              </RouterLink>
            </li>
            <li>
              <RouterLink class="dropdown-item d-flex align-items-center" to="/portafoglio" @click="isMenuOpen = false">
                <i class="bi bi-wallet2 me-2"></i>
                Il Tuo Portafoglio
              </RouterLink>
            </li>
            <li>
              <hr class="dropdown-divider" />
            </li>
            <li>
              <a class="dropdown-item text-danger fw-bold d-flex align-items-center" href="#"
                @click.prevent="handleLogout">
                <IconLogout class="me-2" width="18" height="18" />
                Esci
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </header>

  <div class="modal fade" id="modalLogin" ref="modalElement" tabindex="-1" aria-labelledby="modalLoginLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content parkly-modal">
        <div class="modal-header border-0 p-4 pb-0">
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body text-center px-4 pb-5">
          <img :src="logoUrl" alt="logo parkly" width="80" class="mb-4" />
          <h2 class="modal-title-text mb-4">Bentornato su Parkly</h2>

          <div v-if="loginError" class="alert error mb-4 text-start">
            {{ loginError }}
          </div>

          <form @submit.prevent="handleLogin">
            <div class="mb-3">
              <input type="text" class="form-control modal-input" :class="{ 'is-invalid-input': loginError }"
                placeholder="Email o Nome Utente" v-model="loginIdentificatore" required />
            </div>
            <div class="mb-3">
              <div class="input-group password-group" :class="{ 'is-invalid-group': loginError }">
                <input :type="isPasswordVisible ? 'text' : 'password'" class="form-control password-field"
                  placeholder="Password" v-model="loginPassword" required />
                <button class="btn toggle-password-btn" type="button" @click="isPasswordVisible = !isPasswordVisible"
                  tabindex="-1">
                  <img :src="isPasswordVisible ? eyeClosedUrl : eyeUrl" class="password-icon" alt="Toggle Password" />
                </button>
              </div>
            </div>
            <div class="d-grid mt-4">
              <button type="submit" class="modal-submit-btn">Accedi</button>
            </div>
          </form>

          <div class="mt-4 modal-footer-text">
            <p class="mb-0">
              Non hai un account?
              <a href="#" @click.prevent="goToRegister" class="register-link">Registrati ora </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped>
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 2rem;
  background-color: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.logo-image {
  height: 50px;
  transition: filter 0.3s ease, transform 0.3s ease;
}

/* Glow intorno al logo SVG */
.logo-image:hover {
  filter: drop-shadow(0 0 12px rgba(0, 64, 138, 0.5));
  transform: scale(1.03);
}

.right-section {
  display: flex;
  align-items: center;
  gap: 1.8rem;
}

.nav-item {
  text-decoration: none;
  color: #2c3e50;
  font-weight: 600;
  font-size: 1rem;
  transition: color 0.3s ease;
}

.nav-item:hover {
  color: #00408a;
}

/* -- BOTTONI E PILLOLA UTENTE -- */
.auth-buttons-group {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}

.login-btn,
.register-btn,
.user-name-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-size: 1rem;
  border-radius: 25px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.login-btn,
.register-btn {
  padding: 0 1.5rem;
  font-weight: 700;
}

.login-btn {
  background-color: #00408a;
  color: white !important;
  border: 1.8px solid #00408a;
}

.register-btn {
  color: #00408a !important;
  border: 1.8px solid #00408a;
}

.user-name-btn {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #2c3e50;
  padding: 0 1.6rem;
}

.login-btn:hover,
.user-name-btn:hover,
.register-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.logged-user-zone::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 15px;
}

/* --- STILI DROPDOWN --- */

.parkly-dropdown {
  border-radius: 14px;
  min-width: 220px;
  padding: 0.5rem 0 0.6rem 0;
  overflow: hidden;
  /* Taglia via eventuali sfondi hover che escono dagli angoli arrotondati */
}

.parkly-dropdown .dropdown-item {
  padding: 0.7rem 1.4rem;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
}

.parkly-dropdown .dropdown-item:hover {
  background-color: #f1f5f9;
  color: #00408A;
}

.parkly-dropdown .dropdown-item.text-danger:hover {
  background-color: #fee2e2;
  color: #dc3545 !important;
}
</style>