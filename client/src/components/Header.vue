<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as bootstrap from 'bootstrap'
import logoUrl from '../assets/Primo_Logo_00408A.svg'
import { authStore } from '../store/auth.js' // Importa lo store
import eyeUrl from '../assets/eye-gray.svg'
import eyeClosedUrl from '../assets/eye-closed-gray.svg'

const router = useRouter()

const loginEmail = ref('')
const loginPassword = ref('')
const isMenuOpen = ref(false)
const isPasswordVisible = ref(false)

const modalElement = ref(null)
let modalInstance = null

onMounted(() => {
  modalInstance = new bootstrap.Modal(modalElement.value)
})

onUnmounted(() => {
  if (modalInstance) {
    modalInstance.dispose()
  }
})

const forceCleanupModal = () => {
  document.body.classList.remove('modal-open')
  document.body.style = ''
  const backdrop = document.querySelector('.modal-backdrop')
  if (backdrop) backdrop.remove()
}

const closeLoginModal = () => {
  return new Promise((resolve) => {
    if (!modalElement.value.classList.contains('show')) {
      resolve()
      return
    }

    modalElement.value.addEventListener(
      'hidden.bs.modal',
      () => {
        forceCleanupModal()
        resolve()
      },
      { once: true },
    )

    modalInstance.hide()
  })
}

const handleLogin = async () => {
  const data = await authStore.login(loginEmail.value, loginPassword.value)

  if (data.success) {
    await closeLoginModal()
  } else {
    alert('Errore: ' + (data.error || 'Credenziali non valide'))
  }
}

const goToRegister = async () => {
  await closeLoginModal()
  router.push('/register')
}

const handleLogout = async () => {
  await authStore.logout()
  router.replace('/')
}
</script>

<template>
  <header class="main-header">
    <RouterLink to="/" class="logo-link">
      <div class="logo">
        <img :src="logoUrl" alt="Logo Parkly" class="logo-image" />
      </div>
    </RouterLink>

    <nav class="nav-links">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/garage">Garage</RouterLink>
    </nav>

    <div class="user-actions">
      <template v-if="!authStore.utente">
        <RouterLink to="/register" class="register-btn">Registrati</RouterLink>
        <button type="button" class="login-btn" data-bs-toggle="modal" data-bs-target="#modalLogin">
          Accedi
        </button>
      </template>

      <div 
        v-else 
        class="logged-user-zone position-relative"
        @mouseenter="isMenuOpen = true"
        @mouseleave="isMenuOpen = false"
      >
        
        <button class="btn user-name-btn">
          Ciao, <strong>{{ authStore.utente.nome }}</strong>
        </button>
        
        <ul 
          v-if="isMenuOpen" 
          class="dropdown-menu show shadow border-0 parkly-dropdown" 
          style="position: absolute; right: 0; top: 100%; margin-top: 0;"
        >
          <li>
            <RouterLink class="dropdown-item" to="/prenotazioni" @click="isMenuOpen = false">
              Le Tue Prenotazioni
            </RouterLink>
          </li>
          <li>
            <RouterLink class="dropdown-item" to="/profile" @click="isMenuOpen = false">
              I Tuoi Dati
            </RouterLink>
          </li>
          <li><hr class="dropdown-divider"></li>
          <li>
            <a class="dropdown-item text-danger fw-bold" href="#" @click.prevent="handleLogout">
              Esci
            </a>
          </li>
        </ul>

      </div>
      </div>
  </header>

  <div
    class="modal fade"
    id="modalLogin"
    ref="modalElement"
    tabindex="-1"
    aria-labelledby="modalLoginLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content parkly-modal">
        <div class="modal-header border-0">
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body text-center px-4 pb-5">
          <img :src="logoUrl" alt="logo parkly" width="80" class="mb-4" />
          <h2 class="modal-title-text mb-4">Bentornato su Parkly</h2>

          <form @submit.prevent="handleLogin">
            <div class="mb-3">
              <input
                type="email"
                class="form-control modal-input"
                placeholder="Indirizzo Email"
                v-model="loginEmail"
                required
              />
            </div>
            <div class="mb-3">
              <div class="input-group password-group">
                <input
                  :type="isPasswordVisible ? 'text' : 'password'"
                  class="form-control password-field"
                  placeholder="Password"
                  v-model="loginPassword"
                  required
                />
                <button
                  class="btn toggle-password-btn"
                  type="button"
                  @click="isPasswordVisible = !isPasswordVisible"
                  tabindex="-1"
                >
                  <img
                    :src="isPasswordVisible ? eyeClosedUrl : eyeUrl"
                    class="password-icon"
                    alt="Toggle Password"
                  />
                </button>
              </div>
            </div>
            <div class="d-grid mt-4">
              <button type="submit" class="btn btn-primary modal-submit-btn">Accedi</button>
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
  padding: 1rem 5%;
  background-color: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.logo-link {
  text-decoration: none;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-image {
  height: 45px;
  width: auto;
  display: block;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  text-decoration: none;
  color: var(--text-dark);
  font-weight: 600;
  transition: color 0.3s;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.login-btn,
.register-btn {
  padding: 0.6rem 1.5rem;
  border-radius: 25px;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  display: inline-block;
  text-align: center;
  cursor: pointer;
}

.login-btn {
  background-color: #00408a;
  color: white !important;
  border: 2px solid #00408a;
}

.login-btn:hover {
  background-color: #00336e;
  border-color: #00336e;
  transform: translateY(-2px);
}

.register-btn {
  background-color: transparent;
  color: #00408a !important;
  border: 2px solid #00408a;
}

.register-btn:hover {
  background-color: #00408a;
  color: white !important;
  transform: translateY(-2px);
}

/* --- STILI MODAL PERSONALIZZATI --- */
.parkly-modal {
  border-radius: 24px;
  border: none;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
}

.modal-title-text {
  font-weight: 700;
  color: #00408a;
  font-size: 1.5rem;
}

.modal-input {
  height: 52px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  padding: 10px 18px;
  font-size: 15px;
  transition: all 0.2s ease;
}

.modal-input:focus {
  border-color: #00408a;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
  outline: none;
}

.modal-submit-btn.btn-primary,
.modal-submit-btn {
  background-color: #00408a;
  border: none;
  height: 52px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.1rem;
  color: white;
  transition: background-color 0.2s;
}

.modal-submit-btn.btn-primary:hover,
.modal-submit-btn:hover {
  background-color: #00336e;
  border: none;
}

.modal-submit-btn.btn-primary:focus,
.modal-submit-btn:focus {
  background-color: #00408a;
  border: none;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.modal-submit-btn.btn-primary:active,
.modal-submit-btn:active {
  background-color: #00336e !important;
  border: none !important;
  box-shadow: none !important;
}

.modal-footer-text {
  font-size: 0.9rem;
  color: #6c757d;
}

.register-link {
  color: #00408a;
  font-weight: 700;
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}

/* --- NUOVI STILI MENU UTENTE LOGGATO --- */
.logged-user-zone {
  display: flex;
  align-items: center;
}

.user-name-btn {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #2c3e50;
  border-radius: 25px;
  padding: 0.5rem 1.2rem;
  font-size: 0.95rem;
  transition: all 0.3s;
}

.user-name-btn:hover, .user-name-btn:focus {
  background-color: #e9ecef;
  border-color: #ced4da;
}

.parkly-dropdown {
  border-radius: 16px;
  overflow: hidden; /* Mantiene i bordi arrotondati anche all'hover degli item */

  border-top: 10px solid transparent; /* Questo è il "ponte" su cui cammina il mouse */
  background-clip: padding-box; /* Evita che un eventuale colore di sfondo invada il ponte invisibile */
  margin-top: 0 !important; /* Assicuriamoci che non ci siano margini residui */
}

.parkly-dropdown .dropdown-item {
  padding: 0.6rem 1.5rem;
  font-weight: 500;
  color: #2c3e50;
  transition: background-color 0.2s;
}

.parkly-dropdown .dropdown-item:hover {
  background-color: #f1f5f9;
  color: #00408A;
}

/* Stile speciale per il tasto Esci */
.parkly-dropdown .dropdown-item.text-danger:hover {
  background-color: #fee2e2;
  color: #dc3545 !important;
}

.password-group {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
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
