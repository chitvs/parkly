<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as bootstrap from 'bootstrap'
import logoUrl from '../assets/Primo_Logo_00408A.svg'
import { authStore } from '../store/auth.js' // Importa lo store
import eyeUrl from '../assets/eye-gray.svg'
import eyeClosedUrl from '../assets/eye-closed-gray.svg'

const router = useRouter()

const loginEmail = ref('')
const loginPassword = ref('')
const isPasswordVisible = ref(false)

const forceCleanupModal = () => {
  // Rimuove le classi di blocco di Bootstrap dal body
  document.body.classList.remove('modal-open')
  document.body.style = ''
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
}

const handleLogin = async () => {
  const data = await authStore.login(loginEmail.value, loginPassword.value)

  if (data.success) {
    const modalElement = document.getElementById('modalLogin')
    const modal = bootstrap.Modal.getInstance(modalElement)
    modal.hide()

    modalElement.addEventListener(
      'hidden.bs.modal',
      () => {
        forceCleanupModal()
      },
      { once: true },
    )
  } else {
    alert('Errore: ' + (data.error || 'Credenziali non valide'))
  }
}

const goToRegister = () => {
  const modalElement = document.getElementById('modalLogin')
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement)
  modal.hide()

  // per rimuovere l'ombra che rimarrebbe quando vai su registrati ora
  forceCleanupModal()

  setTimeout(() => {
    router.push('/register')
  }, 100)
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

      <div v-else class="logged-user-zone">
        <span class="user-name"
          >Ciao, <strong>{{ authStore.utente.nome }}</strong></span
        >
        <button @click="handleLogout" class="logout-btn">Esci</button>
      </div>
    </div>
  </header>

  <div
    class="modal fade"
    id="modalLogin"
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
  background-color: var(--primary-blue);
  color: white !important;
  border: 2px solid var(--primary-blue);
}

.login-btn:hover {
  transform: translateY(-2px);
}

.register-btn {
  background-color: transparent;
  color: var(--primary-blue) !important;
  border: 2px solid var(--primary-blue);
}

.register-btn:hover {
  background-color: var(--primary-blue);
  color: white !important;
  transform: translateY(-2px);
}

/* --- NUOVI STILI MODAL PERSONALIZZATI --- */
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
}

.modal-input:focus {
  border-color: #00408a; /*primary blue*/
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.modal-submit-btn {
  background-color: #00408a;
  border: none;
  height: 52px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.1rem;
}

.modal-submit-btn:focus {
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
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

.logged-user-zone {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.user-name {
  color: #2c3e50;
  font-size: 0.95rem;
}

.logout-btn {
  background: transparent;
  border: 1px solid #dc3545;
  color: #dc3545;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  transition: all 0.3s;
  cursor: pointer;
}

.logout-btn:hover {
  background-color: #dc3545;
  color: white;
}

.password-group {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
}

.password-group:focus-within {
  border-color: #00408a; /*primary blue*/
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.password-field {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  height: 52px;
}

/* Bottone e Icona */
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
