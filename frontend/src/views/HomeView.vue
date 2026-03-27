<!-- 
 ref = serve a creare variabili "reattive" 
 onMounted serve a fare cose esattamente nel momento in cui la pagina finisce di caricare.

-->

<script setup>
import { ref, onMounted } from 'vue'

// Creiamo la variabile che mostrerà lo stato del server a schermo (la inizializziamo con un messaggio di attesa) 
const messaggioDalServer = ref('In attesa del database...')

// Funzione per chiamare il tuo backend sulla porta 3000 e aggiornare il messaggio a schermo in base alla risposta
const collegaAlDatabase = async () => {
  try {
    const risposta = await fetch('http://localhost:3000/') 
    if (!risposta.ok) throw new Error('Errore dal server')
    
    const dati = await risposta.text() // Se il server restituisce un testo semplice, altrimenti usa .json() se restituisce JSON
    messaggioDalServer.value = "🟢 Backend Connesso: " + dati
  } catch (errore) {
    messaggioDalServer.value = "🔴 Errore: " + errore.message
  }
}

// Avvia la chiamata appena apri la pagina
onMounted(() => {
  collegaAlDatabase()
})
</script>
<template>
    <div class="server-status">
      Status Server: {{ messaggioDalServer }}
    </div>
  <div class="home-wrapper">
    
    <header class="placeholder-header">Navigazione Parkly</header>

    <main class="main-content">
      <section class="hero">
        <h1 class="hero-title">Trova il parcheggio perfetto con <span class="highlight">Parkly</span></h1>
        <p class="hero-subtitle">
          La webapp intelligente per gestire i tuoi spazi in modo semplice e veloce. 
          Unisciti a noi e semplifica la tua giornata.
        </p>
        <button class="cta-button">Inizia ora</button>
      </section>
    </main>

    <footer class="placeholder-footer">Footer Parkly &copy; 2026</footer>
    
  </div>
</template>

<style scoped>
/* 1. VARIABILI CSS: Il segreto dei veri professionisti per mantenere i colori coerenti */
.home-wrapper {
  --primary-color: #2ecc71; /* Il verde principale di Parkly */
  --primary-dark: #27ae60;
  --text-dark: #2c3e50;
  --text-light: #7f8c8d;
  --bg-light: #f8f9fa;

  /* Flexbox per spingere il footer sempre in fondo allo schermo */
  display: flex;
  flex-direction: column;
  min-height: 100vh; 
  font-family: 'Inter', 'Segoe UI', sans-serif;

  .server-status {
  background-color: #333;
  color: #f1c40f;
  text-align: center;
  padding: 10px;
  font-family: monospace;
}
}

/* 2. STILI TEMPORANEI: Per visualizzare l'ingombro di Header e Footer */
.placeholder-header, .placeholder-footer {
  background-color: var(--text-dark);
  color: white;
  padding: 1.5rem;
  text-align: center;
  font-weight: bold;
  letter-spacing: 1px;
}

/* 3. IL CORPO CENTRALE: Occupa tutto lo spazio rimanente (flex: 1) e centra il contenuto */
.main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-light);
  padding: 2rem;
}

/* 4. LA SEZIONE HERO: Il blocco visivo di forte impatto */
.hero {
  text-align: center;
  max-width: 650px; /* Evita che il testo diventi troppo largo sugli schermi grandi */
}

.hero-title {
  font-size: 3rem;
  color: var(--text-dark);
  margin-bottom: 1rem;
  line-height: 1.2;
}

.highlight {
  color: var(--primary-color); /* Diamo enfasi al nome del brand */
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-light);
  margin-bottom: 2.5rem;
  line-height: 1.6;
}

/* 5. IL BOTTONE CALL-TO-ACTION (CTA) con animazioni fluide */
.cta-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 15px 40px;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 50px; /* Bordi arrotondati moderni */
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(46, 204, 113, 0.2);
  transition: all 0.3s ease; /* Transizione morbida */
}

.cta-button:hover {
  background-color: var(--primary-dark);
  transform: translateY(-3px); /* Effetto sollevamento al passaggio del mouse */
  box-shadow: 0 6px 12px rgba(46, 204, 113, 0.3);
}
</style>