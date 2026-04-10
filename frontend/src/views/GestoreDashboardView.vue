<template>
  <div class="dashboard-layout">
    
    <aside class="sidebar">
      <h2>Area Gestore</h2>
      <nav>
        <a href="#" :class="{ active: vistaAttiva === 'statistiche' }" @click.prevent="vistaAttiva = 'statistiche'">
          📊 Statistiche Generali
        </a>
        <a href="#" :class="{ active: vistaAttiva === 'stato' }" @click.prevent="vistaAttiva = 'stato'">
          🏢 Stato Corrente
        </a>
        <a href="#" :class="{ active: vistaAttiva === 'mappa' }" @click.prevent="vistaAttiva = 'mappa'">
          🗺️ Mappa Posti
        </a>
        <a href="#" :class="{ active: vistaAttiva === 'storico' }" @click.prevent="vistaAttiva = 'storico'">
          📖 Storico Prenotazioni
        </a>
        <a href="#" :class="{ active: vistaAttiva === 'aggiungi' }" @click.prevent="vistaAttiva = 'aggiungi'">
          ➕ Aggiungi Garage
        </a>
      </nav>
    </aside>

    <main class="dashboard-content">
      <header class="top-header">
        <h1>Dashboard di Gestione</h1>
        <p>Benvenuto, gestore. Qui puoi monitorare tutti i tuoi garage.</p>
      </header>

      <section v-if="vistaAttiva === 'aggiungi'" class="vista-sezione">
        <h2>Pubblica un Nuovo Garage</h2>
        <p>Inserisci i dettagli del nuovo parcheggio per attivarlo nel sistema.</p>
        
        <form @submit.prevent="salvaNuovoGarage" class="form-aggiunta">
          <div class="form-group">
            <label>Nome del Garage</label>
            <input type="text" v-model="nuovoGarage.nome" required placeholder="Es. Garage Roma Centro">
          </div>
          
          <div class="form-group">
            <label>Indirizzo Completo</label>
            <input type="text" v-model="nuovoGarage.indirizzo" required placeholder="Es. Via Roma 10, Milano">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Capienza Totale (Posti)</label>
              <input type="number" v-model="nuovoGarage.capienza" required min="1">
            </div>
            <div class="form-group">
              <label>Prezzo Orario (€)</label>
              <input type="number" step="0.50" v-model="nuovoGarage.prezzo" required min="0">
            </div>
          </div>

          <div class="form-group">
            <label>Planimetria (Opzionale)</label>
            <input type="file" accept="image/*, .pdf">
            <small>Carica un'immagine (JPG/PNG) o un PDF della mappa.</small>
          </div>

          <button type="submit" class="btn-submit" :disabled="staSalvando">
            {{ staSalvando ? 'Salvataggio in corso...' : 'Pubblica Garage' }}
          </button>
        </form>
      </section>

      <section v-if="vistaAttiva === 'statistiche'" class="vista-sezione">
        <h2>Riassunto Mensile</h2>
        
        <div class="stats-cards">
          <div class="card">
            <h3>Totale Garage</h3>
            <p class="numero-grande">{{ statistiche.totaleGarage }}</p>
          </div>
          <div class="card">
            <h3>Guadagno Mese</h3>
            <p class="numero-grande">€ {{ statistiche.guadagnoMese }}</p>
          </div>
        </div>

        <h2>I Tuoi Garage</h2>
        <table class="tabella-garage">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome Garage</th>
              <th>Posti Occupati</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="garage in mieiGarage" :key="garage.id">
              <td>#{{ garage.id }}</td>
              <td>{{ garage.nome }}</td>
              <td>{{ garage.postiOccupati }} / {{ garage.postiTotali }}</td>
              <td>
                <span :class="['badge-stato', garage.stato.toLowerCase()]">{{ garage.stato }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="vistaAttiva === 'stato'" class="vista-sezione">
        <h2>Stato Corrente in Tempo Reale</h2>
        <div class="alert alert-warning">
          ⚠️ <strong>Attenzione:</strong> Il "Parcheggio Milano" è attualmente al 98% della capacità!
        </div>
      </section>

      <section v-if="vistaAttiva === 'mappa'" class="vista-sezione">
        <h2>Mappa Interattiva Parcheggio (Demo)</h2>
        <div class="grid-posti">
          <div v-for="n in 20" :key="n" :class="['posto', n % 3 === 0 ? 'occupato' : 'libero']">
            P{{ n }}
          </div>
        </div>
      </section>

      <section v-if="vistaAttiva === 'storico'" class="vista-sezione">
        <h2>Ultime Prenotazioni</h2>
        <table class="tabella-garage">
          <thead>
            <tr>
              <th>Data</th><th>Cliente</th><th>Targa</th><th>Importo</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>09/04/2026</td><td>Mario Rossi</td><td>AB123CD</td><td>€ 15.00</td></tr>
            <tr><td>09/04/2026</td><td>Giulia Bianchi</td><td>EF456GH</td><td>€ 22.50</td></tr>
            <tr><td>08/04/2026</td><td>Luca Verdi</td><td>ZA999ZZ</td><td>€ 10.00</td></tr>
          </tbody>
        </table>
      </section>

    </main>
  </div>
</template>


<script setup>
import { ref, onMounted } from 'vue'

// ==========================================
// [ 1. STATE MANAGEMENT (Data Layer) ]
// Utilizzo della Composition API. Manteniamo lo stato reattivo ben separato in domini logici.
// ==========================================

// --- UI State ---
const vistaAttiva = ref('statistiche') // Traccia la tab corrente
const staSalvando = ref(false)         // Mutex per prevenire double-submissions (UI Loading State)

// --- Domain State (Dati dal Backend) ---
const mieiGarage = ref([])
const statistiche = ref({
  totaleGarage: 0,
  guadagnoMese: 0
})

// --- Form State (Payload Data) ---
const nuovoGarage = ref({
  nome: '',
  indirizzo: '',
  capienza: null,
  prezzo: null
})


// ==========================================
// [ 2. BUSINESS LOGIC & API SERVICES ]
// ==========================================

/**
 * FETCH SERVICE: Recupera lo stato globale della dashboard.
 * Implementa try/catch per l'error handling delle chiamate asincrone.
 */
const caricaDatiDalDatabase = async () => {
  try {
    const risposta = await fetch('http://localhost:3000/api/garages-gestore')
    
    // Controlla lo status code HTTP (es. 200 OK) prima di parsare il JSON
    if (risposta.ok) {
      const dati = await risposta.json()
      // Aggiornamento dello stato reattivo (triggera il re-render del DOM)
      mieiGarage.value = dati.listaGarages
      statistiche.value = dati.stats
    } else {
      console.warn(`Server ha risposto con codice: ${risposta.status}`);
    }
  } catch (error) {
    // Graceful degradation: in un'app reale qui invieremmo l'errore a un sistema di log (es. Sentry)
    console.error("Errore di rete durante il fetch iniziale:", error)
  }
}

/**
 * MUTATION SERVICE: Invia il payload JSON al backend per la creazione di una nuova risorsa.
 */
const salvaNuovoGarage = async () => {
  staSalvando.value = true; // Set lock
  
  try {
    const risposta = await fetch('http://localhost:3000/api/garages-gestore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json' // Definizione esplicita del MIME type del payload
      },
      body: JSON.stringify(nuovoGarage.value) // Serializzazione dell'oggetto reattivo
    });

    if (risposta.ok) {
      alert("Garage pubblicato con successo!"); // TODO: Sostituire con un Toast component (es. Vue-Toastification)
      
      // 1. Reset dello stato del form
      nuovoGarage.value = { nome: '', indirizzo: '', capienza: null, prezzo: null };
      
      // 2. Redirect logico dell'utente
      vistaAttiva.value = 'statistiche';
      
      // 3. Data Invalidation & Refetch: Assicuriamo che la UI rifletta la source-of-truth del server
      caricaDatiDalDatabase(); 
    } else {
      alert("Errore durante il salvataggio.");
    }
  } catch (error) {
    console.error("Errore di rete durante la POST:", error);
  } finally {
    staSalvando.value = false; // Release lock in ogni caso (sia successo che eccezione)
  }
}


// ==========================================
// [ 3. LIFECYCLE HOOKS ]
// ==========================================
onMounted(() => {
  // Bootstrap data fetch non appena il componente viene montato nel DOM
  caricaDatiDalDatabase()
})
</script>


<style scoped>
/* ==========================================
   [ STYLESHEET ARCHITECTURE ]
   Utilizzo di attributo 'scoped' per incapsulare il CSS ed evitare la collisione globale.
   Adottiamo pattern moderni (CSS Grid, Flexbox, box-sizing coerente).
   ========================================== */

/* --- 1. RESET E LAYOUT GLOBALE --- */
* {
  box-sizing: border-box; /* Previene la dilatazione del layout a causa di padding/border */
}

.dashboard-layout {
  display: flex;
  min-height: 100vh;
  background-color: #f4f7f6;
  font-family: 'Inter', sans-serif;
  margin: -8px; /* Override margini di default del body se non è presente un reset globale (es. normalize.css) */
}

/* --- 2. SIDEBAR DI NAVIGAZIONE --- */
.sidebar {
  width: 250px;
  background-color: #002e5c;
  color: white;
  padding: 2rem 1rem;
  box-shadow: 4px 0 10px rgba(0,0,0,0.1); /* Z-index implicito per profondità */
}

.sidebar h2 {
  color: #2ecc71;
  margin-bottom: 2rem;
  font-size: 1.5rem;
  text-align: center;
}

.sidebar nav a {
  display: block;
  color: #a0b8d3;
  padding: 12px 15px;
  text-decoration: none;
  border-radius: 8px;
  margin-bottom: 8px;
  font-weight: 500;
  transition: all 0.3s ease; /* Micro-interazioni per migliorare la UX percettiva */
}

.sidebar nav a:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.sidebar nav a.active {
  background-color: #2ecc71;
  color: #002e5c;
  font-weight: bold;
}

/* --- 3. CONTENITORE PRINCIPALE E HEADER --- */
.dashboard-content {
  flex: 1;
  padding: 2rem 3rem;
  overflow-y: auto;
}

.top-header {
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 1rem;
}

.top-header h1 { margin: 0 0 5px 0; color: #333; }
.top-header p { margin: 0; color: #666; }

/* --- 4. COMPONENTI UI: STATISTICHE E KPI --- */
.stats-cards {
  display: flex;
  gap: 20px;
  margin-bottom: 2rem;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  flex: 1;
  text-align: center;
}

.card h3 { margin: 0; color: #7f8c8d; font-size: 1.1rem; }
.numero-grande { font-size: 2.5rem; font-weight: bold; color: #002e5c; margin: 10px 0 0 0; }

/* --- 5. COMPONENTI UI: TABELLE DATI --- */
.tabella-garage {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.tabella-garage th, .tabella-garage td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.tabella-garage th { background-color: #002e5c; color: white; font-weight: 600; }

/* --- 6. UTILITY CLASSES (Badges e Allarmi) --- */
.badge-stato {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: bold;
}

/* Mappatura classi dinamiche iniettate dal template Vue */
.badge-stato.attivo { background-color: #d4edda; color: #155724; }
.badge-stato.pieno { background-color: #f8d7da; color: #721c24; }

.alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
.alert-warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; }

/* --- 7. MODULO UI: CSS GRID (Mappa Posti) --- */
.grid-posti {
  display: grid;
  /* Auto-fill per layout responsivo automatico senza media queries esplicite */
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.posto {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: bold;
  color: white;
  box-shadow: inset 0 -3px 0 rgba(0,0,0,0.2); /* Skeumorfismo leggero per i bottoni/posti */
}
.posto.libero { background-color: #2ecc71; }
.posto.occupato { background-color: #e74c3c; }

/* --- 8. COMPONENTI UI: FORMS --- */
.form-aggiunta {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  max-width: 600px;
  margin-top: 15px;
}

.form-group { margin-bottom: 20px; }

.form-row { display: flex; gap: 20px; }
.form-row .form-group { flex: 1; }

label { display: block; font-weight: 600; margin-bottom: 8px; color: #333; }

input[type="text"], input[type="number"], input[type="file"] {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
}

.btn-submit {
  background-color: #2ecc71;
  color: white;
  border: none;
  padding: 15px 25px;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  width: 100%;
  transition: 0.2s;
}

.btn-submit:hover { background-color: #27ae60; }
.btn-submit:disabled { background-color: #95a5a6; cursor: not-allowed; }

/* --- 9. ANIMAZIONI DI TRANSIZIONE (Component Lifecycle) --- */
.vista-sezione {
  animation: fadeIn 0.4s ease-in-out;
}

/* Animazione in-mounting per dare fluidità allo switch tra le tab */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>