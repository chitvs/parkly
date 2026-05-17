<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { authStore } from '../store/auth.js'
import logoInteroUrl from '../assets/LogoParklyInteroBianco.svg'
import IconGitHub from '../icons/IconGitHub.vue';

const router = useRouter()
const messaggio = ref(null)

const handleProtectedNavigation = (path, requiresNotGestore = false) => {
    // controlla il login
    if (!authStore.utente) {
        messaggio.value = { tipo: 'error', testo: 'Devi effettuare l\'accesso per visualizzare questa pagina.' }
        return
    }

    // se è "Diventa Gestore", l'utente non deve esserlo già
    if (requiresNotGestore && authStore.utente.ruolo === 'GESTORE') {
        messaggio.value = { tipo: 'error', testo: 'Sei già un gestore della piattaforma!' }
        return
    }

    // tutto ok, naviga
    messaggio.value = null
    router.push(path)
}
</script>

<template>
  <footer class="main-footer">
    
    <!-- Alert Globale del Footer -->
    <div v-if="messaggio" :class="['alert', messaggio.tipo, 'alert-fixed-bottom']">
        {{ messaggio.testo }}
        <button @click="messaggio = null" class="close-btn">x</button>
    </div>

    <div class="footer-container">
      <div class="footer-content">
        
        <div class="footer-column brand-column">
          <div class="logo">
            <img :src="logoInteroUrl" alt="Logo Parkly" class="logo-image" width="180px" color="#ffffff"/>
          </div>
          <p class="brand-slogan">
            Trova, prenota e gestisci il tuo parcheggio in modo semplice, veloce e sicuro. Ovunque tu sia.
          </p>
          
          <div class="github-container">
            <a href="https://github.com/chitvs/parkly" target="_blank" class="github-pill">
              <IconGitHub></IconGitHub>
              <span>Codice del Progetto</span>
            </a>
          </div>
        </div>

        <div class="footer-column">
          <h4>Esplora</h4>
          <ul>
            <li><RouterLink to="/">Home</RouterLink></li>
            <li><RouterLink to="/garage">Trova un garage</RouterLink></li>
            <li><a href="#" @click.prevent="handleProtectedNavigation('/diventa-gestore', true)">Diventa Gestore</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h4>Il Tuo Account</h4>
          <ul>
            <li><a href="#" @click.prevent="handleProtectedNavigation('/prenotazioni')">Le tue prenotazioni</a></li>
            <li><a href="#" @click.prevent="handleProtectedNavigation('/profile')">I Tuoi Dati</a></li>
            <li><a href="#" @click.prevent="handleProtectedNavigation('/portafoglio')">Il Tuo Portafoglio</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h4>Sviluppato da:</h4>
          <ul>
            <li><a href="https://github.com/andrea222341">Carbone Andrea</a></li>
            <li><a href="https://github.com/chitvs">Chitarrini Alessandro</a></li>
            <li><a href="https://github.com/m169mm">Crugliano Matteo</a></li>
            <li><a href="https://github.com/davide242">Gaglione Davide</a></li>
          </ul>
        </div>

      </div>
    </div>

    <div class="footer-bottom">
      <div class="footer-container bottom-flex">
        <p>&copy; {{ new Date().getFullYear() }} Parkly. Tutti i diritti riservati.</p>
        <div class="bottom-extra">
          <span>IT | EUR</span>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.main-footer {
  background-color: #001D3D; 
  color: #94a3b8; 
  font-family: 'Inter', 'Segoe UI', sans-serif;
  margin-top: auto; 
  padding-top: 4rem;
  position: relative;
}

.footer-container {
  width: 100%;
  max-width: 1300px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Griglia per distribuire bene lo spazio (2 porzioni al brand, 1 alle altre) */
.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.brand-name {
  color: #ffffff;
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 1rem;
  letter-spacing: -0.5px;
}

.brand-slogan {
  line-height: 1.6;
  font-size: 0.95rem;
  margin-bottom: 2 rem;
  margin-top: 1.5rem;
  max-width: 300px;
}

.github-container {
  margin-top: 0.5rem;
}

.github-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 1.3rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 30px;
  color: #ffffff;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.github-pill:hover {
  background-color: #ffffff;
  color: #06162d; 
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.github-pill svg {
  transition: transform 0.3s ease;
}

.github-pill:hover svg {
  transform: rotate(10deg) scale(1.1);
}

/* Titoli delle colonnine */
.footer-column h4 {
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  position: relative;
}

/* Liste di link */
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

ul li {
  margin-bottom: 0.8rem;
}

ul a {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  display: inline-block;
  cursor: pointer;
}

/* Bellissimo effetto hover: il testo si illumina e scorre di 4px a destra */
ul a:hover {
  color: #ffffff;
  transform: translateX(4px);
}

/* Footer Bottom (Linea inferiore) */
.footer-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem 0;
  font-size: 0.85rem;
  background-color: #030e1d; /* Tonalità ancora più scura per lo stacco */
}

.bottom-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-bottom p {
  margin: 0;
}

.bottom-extra span {
  cursor: pointer;
  transition: color 0.2s;
}

.bottom-extra span:hover {
  color: #ffffff;
}

/* Responsività per schermi più piccoli */
@media (max-width: 992px) {
  .footer-content {
    grid-template-columns: 1fr 1fr; /* Su tablet passa a 2 colonne */
  }
}

@media (max-width: 576px) {
  .footer-content {
    grid-template-columns: 1fr; /* Su smartphone passa a 1 colonna */
    gap: 2rem;
  }
  
  .bottom-flex {
    flex-direction: column;
    text-align: center;
  }
}
</style>