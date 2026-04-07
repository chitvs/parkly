<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as bootstrap from 'bootstrap'
import logoUrl from '../assets/Primo_Logo_00408A.svg'
import { authStore } from '../store/auth.js' // Importa lo store

const router = useRouter()

const loginEmail = ref('')
const loginPassword = ref('')
const isMenuOpen = ref(false)

const forceCleanupModal = () => {
  // Rimuove le classi di blocco di Bootstrap dal body
  document.body.classList.remove('modal-open');
  document.body.style = '';
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
}

const handleLogin = async () => {
  const data = await authStore.login(loginEmail.value, loginPassword.value);

  if (data.success) {
    const modalElement = document.getElementById('modalLogin');
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal.hide();
    
    modalElement.addEventListener('hidden.bs.modal', () => {
      forceCleanupModal();
    }, { once: true });
  } else {
    alert("Errore: " + (data.error || "Credenziali non valide"));
  }
}

const goToRegister = () => {
  const modalElement = document.getElementById('modalLogin');
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  modal.hide()

  // per rimuovere l'ombra che rimarrebbe quando vai su registrati ora
  forceCleanupModal();

  setTimeout(() => {
    router.push('/register');
  }, 100);
}

const handleLogout = async () => {
  await authStore.logout(); 
  router.push('/');
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
            <RouterLink class="dropdown-item" to="/profilo" @click="isMenuOpen = false">
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

  <div class="modal fade" id="modalLogin" tabindex="-1" aria-labelledby="modalLoginLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content parkly-modal">
        
        <div class="modal-header border-0">
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body text-center px-4 pb-5">
          <img :src="logoUrl" alt="logo parkly" width="80" class="mb-4">
          <h2 class="modal-title-text mb-4">Bentornato su Parkly</h2>
          
          <form @submit.prevent="handleLogin">
            <div class="mb-3">
              <input 
                type="email" 
                class="form-control modal-input" 
                placeholder="Indirizzo Email" 
                v-model="loginEmail" 
                required
              >
            </div>
            <div class="mb-3">
              <input 
                type="password" 
                class="form-control modal-input" 
                placeholder="Password" 
                v-model="loginPassword" 
                required
              >
            </div>
            <div class="d-grid mt-4">
              <button type="submit" class="btn btn-primary modal-submit-btn">Accedi</button>
            </div>
          </form>

          <div class="mt-4 modal-footer-text">
            <p class="mb-0">Non hai un account? 
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

.logo-link { text-decoration: none; }
.logo { display: flex; align-items: center; }
.logo-image { height: 45px; width: auto; display: block; }

.nav-links { display: flex; gap: 2rem; }
.nav-links a {
  text-decoration: none;
  color: var(--text-dark);
  font-weight: 600;
  transition: color 0.3s;
}

.user-actions { display: flex; align-items: center; gap: 1rem; }

.login-btn, .register-btn {
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

.login-btn:hover { transform: translateY(-2px); }

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

/* --- STILI MODAL PERSONALIZZATI --- */
.parkly-modal {
  border-radius: 24px;
  border: none;
  box-shadow: 0 15px 50px rgba(0,0,0,0.2);
}

.modal-title-text {
  font-weight: 700;
  color: #00408A;
  font-size: 1.5rem;
}

.modal-input {
  height: 52px;
  border-radius: 12px;
  border: 1px solid #dee2e6;
  padding: 0 15px;
}

.modal-input:focus {
  border-color: #00408A;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.modal-submit-btn {
  background-color: #00408A;
  border: none;
  height: 52px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.1rem;
}

.modal-footer-text {
  font-size: 0.9rem;
  color: #6c757d;
}

.register-link {
  color: #00408A;
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
  margin-top: 10px !important;
  overflow: hidden; /* Mantiene i bordi arrotondati anche all'hover degli item */
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

</style>