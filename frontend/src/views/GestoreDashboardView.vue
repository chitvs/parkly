<script setup>
// Importiamo 'ref' per le variabili reattive e 'onMounted' per l'avvio automatico
import { ref, onMounted } from 'vue'

// === 1. STATO INIZIALE (Foglio Bianco) ===
// Partiamo con un array vuoto. La tabella all'inizio non avrà righe.
const mieiGarage = ref([])

// Partiamo con le statistiche a zero.
const statistiche = ref({
  totaleGarage: 0,
  guadagnoMese: 0
})

// === 2. LA CHIAMATA AL SERVER (Il Telefono) ===
// La parola 'async' indica che questa funzione compie un'azione che richiede tempo (chiamare internet)
const caricaDatiDalDatabase = async () => {
  try {
    // Bussiamo alla porta del nostro backend Node.js (assicurati che sia la porta giusta!)
    // 'await' fa mettere in pausa il codice finché il server non risponde
    const risposta = await fetch('http://localhost:3000/api/garages-gestore')
    
    // Se il server dice "Tutto OK" (Codice 200)...
    if (risposta.ok) {
      // "Scartiamo" il pacco JSON che ci ha mandato
      const dati = await risposta.json()
      
      // Versiamo i dati veri dentro le nostre variabili vuote.
      // Appena lo facciamo, Vue disegnerà la tabella in automatico!
      mieiGarage.value = dati.listaGarages
      statistiche.value = dati.stats
    } else {
      console.error("Il server ha risposto, ma c'è un errore (es. rotta non trovata).")
    }
  } catch (errore) {
    // Questo scatta se ti sei dimenticato di accendere il backend!
    console.error("Impossibile connettersi al server Node.js. È acceso?", errore)
  }
}

// === 3. IL GRILLETTO AUTOMATICO ===
// onMounted significa: "Appena il browser ha finito di disegnare l'HTML base, spara questa funzione"
onMounted(() => {
  caricaDatiDalDatabase()
})
</script>

<template>
  <div class="dashboard-layout">
    
    <aside class="sidebar">
      <h2>Parkly Gestore</h2>
      <nav>
        <a href="#" class="active">I Miei Garage</a>
        <a href="#">Prenotazioni</a>
      </nav>
    </aside>

    <main class="dashboard-content">
      
      <header class="dashboard-header">
        <h1>Bentornato, Gestore</h1>
        <button class="btn-primary">+ Aggiungi Nuovo Garage</button>
      </header>

      <section class="stats-grid">
        <div class="stat-card">
          <h3>Garage Attivi</h3>
          <p class="stat-number">{{ statistiche.totaleGarage }}</p>
        </div>
        <div class="stat-card">
          <h3>Incasso Mensile</h3>
          <p class="stat-number">€ {{ statistiche.guadagnoMese }}</p>
        </div>
      </section>

      <section class="garages-list">
        <h2>Gestione Strutture</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>Nome Struttura</th>
              <th>Occupazione</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="garage in mieiGarage" :key="garage.id">
              <td>{{ garage.nome }}</td>
              <td>{{ garage.postiOccupati }} / {{ garage.postiTotali }}</td>
              <td><span :class="['status-badge', garage.stato.toLowerCase()]">{{ garage.stato }}</span></td>
              <td><button class="btn-small">Modifica</button></td>
            </tr>
          </tbody>
        </table>
      </section>
      
    </main>
  </div>
</template>

<style scoped>
/* Il CSS rimane identico a prima per mantenere il design perfetto */

.dashboard-layout { 
  display: flex; 
  height: 100vh; 
  background-color: #f4f7f6; 
  font-family: 'Inter', sans-serif;
}

.sidebar { 
  width: 250px; 
  background-color: #002e5c; 
  color: white; 
  padding: 2rem 1rem; 
}
.sidebar h2 { 
  color: #2ecc71; 
  margin-bottom: 2rem; 
}
.sidebar nav a { 
  display: block; 
  color: white; 
  padding: 1rem; 
  text-decoration: none; 
  border-radius: 8px; 
  margin-bottom: 0.5rem; 
}
.sidebar nav a.active, .sidebar nav a:hover { 
  background-color: rgba(255,255,255,0.1); 
}

.dashboard-content { 
  flex: 1; 
  padding: 2rem; 
  overflow-y: auto; 
}
.dashboard-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  margin-bottom: 2rem; 
}
.btn-primary { 
  background-color: #0066cc; 
  color: white; 
  padding: 0.8rem 1.5rem; 
  border: none; 
  border-radius: 8px; 
  cursor: pointer; 
  font-weight: bold;
}

.stats-grid { 
  display: flex; 
  gap: 1rem; 
  margin-bottom: 2rem; 
}
.stat-card { 
  background: white; 
  padding: 1.5rem; 
  border-radius: 8px; 
  flex: 1; 
  box-shadow: 0 2px 10px rgba(0,0,0,0.05); 
}
.stat-number { 
  font-size: 2rem; 
  font-weight: bold; 
  color: #0066cc; 
  margin-top: 0.5rem; 
}

.data-table { 
  width: 100%; 
  background: white; 
  border-collapse: collapse; 
  border-radius: 8px; 
  overflow: hidden; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}
.data-table th, .data-table td { 
  padding: 1rem; 
  text-align: left; 
  border-bottom: 1px solid #eee; 
}

.status-badge { 
  padding: 0.3rem 0.8rem; 
  border-radius: 20px; 
  font-size: 0.85rem; 
  font-weight: bold; 
}
.status-badge.attivo { background-color: #d4edda; color: #155724; }
.status-badge.pieno { background-color: #f8d7da; color: #721c24; }

.btn-small {
  background-color: transparent;
  border: 1px solid #0066cc;
  color: #0066cc;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}
</style>