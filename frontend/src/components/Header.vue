<script setup>
import { RouterLink } from 'vue-router'
// IMPORTIAMO L'IMMAGINE: Diciamo a Vue dove si trova il file del logo
import logoUrl from '../assets/Primo_Logo_00408A.svg'
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
      <RouterLink to="/register" class="register-btn">Registrati</RouterLink>
      <RouterLink to="/login" class="login-btn">Accedi</RouterLink>
    </div>

  </header>
</template>

<style scoped>
/* 1. CONTENITORE PRINCIPALE */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* 1rem = 16 pixel mentre 5% = 5% della larghezza del viewport */
  padding: 1rem 5%;
  background-color: #ffffff;
  /* Sottile ombra per dare profondità */
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  
  /* Effetto Sticky: l'header rimane incollato in alto quando l'utente scorre giù */
  position: sticky;
  top: 0;
  z-index: 1000;
}

/* 2. STILI DEL LOGO */
.logo-link {
  text-decoration: none;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-image {
  height: 45px; /* Modifica questo numero se vuoi il logo più grande o più piccolo */
  width: auto;  /* Evita che il logo si deformi o si schiacci */
  display: block;
}

/* 3. STILI DEI LINK CENTRALI */
.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  text-decoration: none;
  color: #2c3e50;
  font-weight: 600;
  transition: color 0.3s;
}
/*.nav-links a:hover {
  color: #2ecc71;  Diventano verdi al passaggio del mouse 
}*/

/* 4. CONTENITORE AZIONI UTENTE */
.user-actions {
  display: flex;
  align-items: center;
  gap: 1rem; /* Crea spazio automatico tra i due bottoni */
}

/* STILE BASE PER ENTRAMBI I BOTTONI (Per non ripetere codice) */
.login-btn, .register-btn {
  padding: 0.6rem 1.5rem;
  border-radius: 25px;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  display: inline-block;
  text-align: center;
}

/* STILE SPECIFICO: ACCEDI (Solid) */
.login-btn {
  background-color: #00408A;
  color: white !important;
  border: 2px solid #00408A; /* Aggiunto per bilanciare le dimensioni */
}

.login-btn:hover{
  transform: translateY(-2px);
}

/* STILE SPECIFICO: REGISTRATI (Outline) */
.register-btn {
  background-color: transparent;
  color: #312ecc !important;
  border: 2px solid #00408A;
}

.register-btn:hover{
  background-color: #00408A;
  color: white !important;
  transform: translateY(-2px);
}

</style>

