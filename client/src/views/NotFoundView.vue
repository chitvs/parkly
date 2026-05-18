<script setup>
import Header from '@/components/Header.vue';
import Footer from '@/components/Footer.vue';
</script>

<template>
  <div class="layout-wrapper">
    <Header />

    <main class="not-found-container">
      <img src="@/assets/broken_car.png" alt="Errore 404 - Macchina rotta" class="broken-car-img" />

      <h1 class="error-title">404 - Strada senza uscita!</h1>
      <p class="error-message">Ops! Sembra che tu abbia parcheggiato nel posto sbagliato. Questa pagina non esiste.</p>

      <router-link to="/" class="btn-home">Torna alla Home</router-link>
    </main>

    <Footer />
  </div>
</template>


<style scoped>
/* Wrapper aggiunto per garantire che il footer stia in fondo anche su schermi molto alti */
.layout-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Modificato per occupare lo spazio rimanente tra header e footer */
.not-found-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  /* Permette al container di espandersi */
  text-align: center;
  padding: 20px;
  background-color: #F5F5F3;
  font-family: 'Inter', sans-serif;
}

.broken-car-img {
  max-width: 300px;
  height: auto;
  margin-bottom: 2rem;
}

.error-title {
  font-size: 3rem;
  color: #00204A;
  margin-bottom: 1rem;
  font-weight: 700;
}

.error-message {
  font-size: 1.2rem;
  color: #6c757d;
  margin-bottom: 2rem;
}

.btn-home {
  padding: 12px 24px;
  background-color: #0066CC;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.btn-home:hover {
  background-color: #00204A;
}
</style>