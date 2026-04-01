<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as bootstrap from 'bootstrap'
import logoUrl from '../assets/Primo_Logo_00408A.svg'
import { authStore } from '../store/auth.js' // Importa lo store

const router = useRouter()

const loginEmail = ref('')
const loginPassword = ref('')

const forceCleanupModal = () => {
  // Rimuove le classi di blocco di Bootstrap dal body
  document.body.classList.remove('modal-open');
  document.body.style = '';
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
}

const handleLogin = async () => {

  const payload = {
    email: loginEmail.value,
    password: loginPassword.value
  };

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      
      const modalElement = document.getElementById('modalLogin');
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal.hide()
      
      modalElement.addEventListener('hidden.bs.modal', () => {
        forceCleanupModal();
      }, { once: true });
      
      authStore.setUtente(data.utente); // Aggiorna lo store  

    } else {
        alert("Errore: " + (data.error || "Credenziali non valide"));
    }
  } catch (err) {
      console.error("Errore di rete:", err);
      alert("Impossibile connettersi al server. Assicurati che il backend sia attivo.");
  }
}

const goToRegister = () => {
  const modalElement = document.getElementById('modalLogin');
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  
  if (modal) {
    modal.hide();
  }

  // per rimuovere l'ombra che rimarrebbe quando vai su registrati ora
  forceCleanupModal();

  setTimeout(() => {
    router.push('/register');
  }, 100);
}

// Funzione per il Logout
const handleLogout = () => {
  authStore.setUtente(null); // Pulisce sia lo store che il localStorage
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

      <div v-else class="logged-user-zone">
        <span class="user-name">Ciao, <strong>{{ authStore.utente.nome }}</strong></span>
        <button @click="handleLogout" class="logout-btn">Esci</button>
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
/* --- STILI HEADER ESISTENTI --- */
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
  color: #2c3e50;
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
  background-color: #00408A;
  color: white !important;
  border: 2px solid #00408A;
}

.login-btn:hover { transform: translateY(-2px); }

.register-btn {
  background-color: transparent;
  color: #00408A !important;
  border: 2px solid #00408A;
}

.register-btn:hover {
  background-color: #00408A;
  color: white !important;
  transform: translateY(-2px);
}

/* --- NUOVI STILI MODAL PERSONALIZZATI --- */
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

</style>