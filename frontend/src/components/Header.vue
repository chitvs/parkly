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


/* 4. STILE DEL BOTTONE ACCEDI */
.login-btn {
  background-color: #312ecc;
  color: white !important;
  padding: 0.6rem 1.5rem;
  border-radius: 25px;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
}

.login-btn:hover {
  background-color: #27ae60;
  transform: translateY(-2px); /* Effetto sollevamento */
  box-shadow: 0 4px 8px rgba(46, 204, 113, 0.3);
}
</style>