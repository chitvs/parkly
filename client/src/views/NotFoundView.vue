<template>
  <div class="not-found-container">
    <!-- Immagine aggiornata con il nome esatto -->
    <img src="@/assets/broken_car.png" alt="Errore 404 - Macchina rotta" class="broken-car-img" />
    
    <h1 class="error-title">404 - Strada senza uscita!</h1>
    <p class="error-message">Ops! Sembra che tu abbia parcheggiato nel posto sbagliato. Questa pagina non esiste.</p>
    
    <router-link to="/" class="btn-home">Torna al parcheggio sicuro (Home)</router-link>
  </div>
</template>

<style scoped>
.not-found-container { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  min-height: 80vh; 
  text-align: center; 
  padding: 20px; 
  background-color: #F5F5F3; 
  font-family: 'Inter', sans-serif;
}
.broken-car-img { max-width: 300px; height: auto; margin-bottom: 2rem; }
.error-title { font-size: 3rem; color: #00204A; margin-bottom: 1rem; font-weight: 700;}
.error-message { font-size: 1.2rem; color: #6c757d; margin-bottom: 2rem; }
.btn-home { padding: 12px 24px; background-color: #0066CC; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; transition: background-color 0.2s; }
.btn-home:hover { background-color: #00204A; }
</style>