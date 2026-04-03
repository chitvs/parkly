<script setup>
import { ref } from 'vue'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'

// Logica di ricerca invariata
const searchLocation = ref('')
const checkIn = ref('')
const checkOut = ref('')

const handleSearch = () => {
  console.log('Ricerca:', searchLocation.value, checkIn.value, checkOut.value)
  alert(`Cerco parcheggi a ${searchLocation.value} dal ${checkIn.value} al ${checkOut.value}`)
}
</script>

<template>
  <div class="home-wrapper">
    <Header />

    <main class="main-content">
      
      <section class="hero-header">
        <div class="hero-text">
          <h1>Sostare non è mai stato così <span class="highlight">semplice</span>.</h1>
          <p>La piattaforma intelligente per prenotare il tuo posto auto in totale sicurezza.</p>
        </div>
      </section>

      <section class="search-container">
        <!-- significa: "Quando l'utente preme Invio, PREVIENI il comportamento normale del browser (che ricaricherebbe la pagina sfasando tutto) ed esegui solo la mia funzione handleSearch"-->
        <form @submit.prevent="handleSearch" class="search-box">
          
          <div class="input-group location-group">
            <div class="icon">📍</div>
            <div class="fields">
              <label>Dove vuoi parcheggiare?</label>
              <input type="text" v-model="searchLocation" placeholder="Città, indirizzo o stazione..." required>
            </div>
          </div>

          <div class="input-group">
            <label>Check-in</label>
            <input type="datetime-local" v-model="checkIn" required>
          </div>

          <div class="input-group">
            <label>Check-out</label>
            <input type="datetime-local" v-model="checkOut" required>
          </div>

          <button type="submit" class="search-btn">
             Cerca
          </button>
          
        </form>
      </section>

      <section class="why-parkly">
        <h2>Perché scegliere Parkly?</h2>
        <div class="cards-grid">
          <div class="card">
            <div class="card-icon">🔒</div>
            <h3>Posti Sicuri</h3>
            <p>Solo garage verificati e protetti per la tua auto.</p>
          </div>
          <div class="card">
            <div class="card-icon">⚡</div>
            <h3>Prenotazione Rapida</h3>
            <p>Trova e prenota il tuo posto in meno di 2 minuti.</p>
          </div>
          <div class="card">
            <div class="card-icon">💰</div>
            <h3>Tariffe Chiare</h3>
            <p>Nessun costo nascosto, paghi quello che vedi.</p>
          </div>
        </div>
      </section>

    </main>

    <Footer />
  </div>
</template>

<style scoped>

.home-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-light);
  font-family: 'Inter', -apple-system, sans-serif;
}

.main-content {
  flex: 1;
}

/* 2. HERO HEADER BLU PROFONDO */
.hero-header {
  background-color: var(--deep-blue);
  color: var(--white);
  padding: 5rem 2rem 10rem 2rem; /* Spazio extra in basso per il "floating" */
  text-align: center;
}

.hero-text h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.highlight {
  color: var(--accent-blue); /* Un azzurro più chiaro per l'enfasi sul testo blu scuro */
}
/* Stile Sottotitolo Hero:
  - Opacità 80%: dà priorità visiva al titolo principale
  - Max 700px + margin auto: centra il testo e previene righe troppo lunghe
*/
.hero-text p {
  font-size: 1.3rem;
  color: rgba(255,255,255,0.8);
  max-width: 700px;
  margin: 0 auto;
}

/* 3. SEARCH BOX PULITA BIANCA E BLU */
.search-container {
  max-width: 1050px;
  margin: 0 auto;
  padding: 0 1rem;
  margin-top: -4rem; /* Trucco CSS: fluttuazione sopra la zona blu */
  position: relative;
  z-index: 10;
}

.search-box {
  display: flex;
  background: var(--white);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1); /* Ombra più morbida per eleganza */
  gap: 10px;
}

/* Rielaborazione input group per uno stile pulito "app" */
.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1rem;
  background: var(--white);
  border-radius: 8px;
  border: 2px solid var(--border-light); /* Bordo grigio chiaro di base */
  transition: all 0.3s;
}

/* Effetto focus sul gruppo di input */
.input-group:focus-within {  
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.location-group {
  flex: 1.5; /* Più spazio per l'indirizzo */
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.location-group .fields {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.location-group .icon {
  font-size: 1.3rem;
}

.input-group label {
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--primary-blue); /* Label colorate di blu */
  margin-bottom: 4px;
}

.input-group input {
  border: none;
  outline: none;
  font-size: 1rem;
  font-family: inherit;
  width: 100%;
  color: var(--text-dark);
}

.input-group input::placeholder {
  color: #999;
}

/* PULSANTE BLU ACCESO (Call to Action) */
.search-btn {
  background-color: var(--primary-blue);
  color: white;
  border: none;
  font-size: 1.2rem;
  font-weight: bold;
  padding: 0 2.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-btn:hover {
  background-color: #0052a3; /* Un blu leggermente più scuro al passaggio */
  transform: translateY(-2px);
}

/* 4. SEZIONE VANTAGGI SOTTOSTANTE */
.why-parkly {
  max-width: 1050px;
  margin: 6rem auto 4rem auto;
  padding: 0 1rem;
}

.why-parkly h2 {
  color: var(--deep-blue);
  margin-bottom: 2.5rem;
  text-align: center;
  font-size: 2.2rem;
}

.cards-grid {
  display: flex;
  gap: 1.5rem;
}

.card {
  flex: 1;
  background: var(--white);
  padding: 2.5rem 1.5rem;
  text-align: center;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  border: 1px solid var(--border-light);
  transition: transform 0.3s;
}

.card:hover {
  transform: translateY(-5px);
  border-color: rgba(0, 102, 204, 0.2);
}

.card-icon {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
}

.card h3 {
  color: var(--deep-blue);
  margin-bottom: 0.7rem;
}

.card p {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Responsività per Smartphone (Ancora più pulita) */
@media (max-width: 900px) {
  .search-box {
    flex-direction: column;
    padding: 0.5rem;
    gap: 5px;
  }
  .input-group {
    border-radius: 6px;
  }
  .search-btn {
    padding: 1.2rem;
    justify-content: center;
  }
  .cards-grid {
    flex-direction: column;
  }
  .hero-text h1 {
    font-size: 2.2rem;
  }
}
</style>