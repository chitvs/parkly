<template>
 <div class="page-wrapper">
   <Header />


   <!-- ACCESSO NEGATO -->
   <div v-if="!isGestore" class="access-denied">
     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
     <h2>Accesso negato</h2>
     <p>Questa area è riservata ai gestori. Effettua il login con un account gestore.</p>
     <RouterLink to="/" class="btn-back">Torna alla Home</RouterLink>
   </div>


   <!-- DASHBOARD -->
   <div v-else class="dashboard-layout">


     <!-- SIDEBAR -->
     <aside class="sidebar">
       <div class="sidebar-brand">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
         <span>Area Gestore</span>
       </div>


       <nav class="sidebar-nav">
         <a
           v-for="item in navItems"
           :key="item.id"
           href="#"
           :class="['nav-item', { active: vistaAttiva === item.id }]"
           @click.prevent="vistaAttiva = item.id"
         >
           <span class="nav-icon" v-html="item.icon"></span>
           <span class="nav-label">{{ item.label }}</span>
           <span v-if="vistaAttiva === item.id" class="nav-indicator"></span>
         </a>
       </nav>


       <div class="sidebar-user">
         <img
           :src="authStore.utente?.fotoProfilo_URL || '/default-avatar.png'"
           alt="Avatar"
           class="sidebar-avatar"
         />
         <div class="sidebar-user-info">
           <span class="sidebar-user-name">{{ authStore.utente?.nome }} {{ authStore.utente?.cognome }}</span>
           <span class="sidebar-user-role">Gestore</span>
         </div>
       </div>
     </aside>


     <!-- MAIN -->
     <main class="main-content">


       <!-- LOADING -->
       <div v-if="isLoading" class="loading-state">
         <div class="spinner"></div>
         <span>Caricamento dati...</span>
       </div>


       <template v-else>


         <!-- STATISTICHE -->
         <section v-if="vistaAttiva === 'statistiche'" class="vista fade-in">
           <div class="page-header">
             <div>
               <h1>Dashboard</h1>
               <p class="subtitle">Panoramica dei tuoi parcheggi</p>
             </div>
           </div>


           <div class="stats-grid">
             <div class="stat-card">
               <div class="stat-icon stat-icon--blue">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
               </div>
               <div class="stat-body">
                 <span class="stat-label">Garage Totali</span>
                 <span class="stat-value">{{ mieiGarage.length }}</span>
               </div>
             </div>


             <div class="stat-card">
               <div class="stat-icon stat-icon--green">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
               </div>
               <div class="stat-body">
                 <span class="stat-label">Guadagno del Mese</span>
                 <span class="stat-value">€ {{ guadagnoMese }}</span>
               </div>
             </div>


             <div class="stat-card">
               <div class="stat-icon stat-icon--amber">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
               </div>
               <div class="stat-body">
                 <span class="stat-label">Prenotazioni Attive</span>
                 <span class="stat-value">{{ prenotazioniAttive }}</span>
               </div>
             </div>
           </div>


           <div class="section-header">
             <h2>I tuoi garage</h2>
           </div>


           <div class="table-card">
             <table class="parkly-table">
               <thead>
                 <tr>
                   <th>ID</th>
                   <th>Nome Garage</th>
                   <th>Indirizzo</th>
                   <th>Tariffa Base</th>
                   <th>Stato</th>
                 </tr>
               </thead>
               <tbody>
                 <tr v-for="garage in mieiGarage" :key="garage.id_garage">
                   <td class="td-muted">#{{ garage.id_garage }}</td>
                   <td class="td-bold">{{ garage.nome }}</td>
                   <td class="td-muted">{{ garage.indirizzo }}</td>
                   <td>€ {{ garage.tariffabase }}/h</td>
                   <td>
                     <span :class="['badge', garage.isattivo ? 'badge--green' : 'badge--red']">
                       {{ garage.isattivo ? 'Attivo' : 'Inattivo' }}
                     </span>
                   </td>
                 </tr>
                 <tr v-if="mieiGarage.length === 0">
                   <td colspan="5" class="td-empty">Nessun garage trovato.</td>
                 </tr>
               </tbody>
             </table>
           </div>
         </section>


         <!-- STATO CORRENTE -->
         <section v-if="vistaAttiva === 'stato'" class="vista fade-in">
           <div class="page-header">
             <div>
               <h1>Stato Corrente</h1>
               <p class="subtitle">Occupazione in tempo reale dei tuoi garage</p>
             </div>
           </div>


           <div class="stato-grid">
             <div v-for="garage in mieiGarage" :key="garage.id_garage" class="stato-card">
               <div class="stato-card-header">
                 <span class="stato-nome">{{ garage.nome }}</span>
                 <span :class="['badge', garage.isattivo ? 'badge--green' : 'badge--red']">
                   {{ garage.isattivo ? 'Attivo' : 'Inattivo' }}
                 </span>
               </div>
               <p class="stato-indirizzo">{{ garage.indirizzo }}</p>


               <div class="occupancy-wrap">
                 <div class="occupancy-bar">
                   <div
                     class="occupancy-fill"
                     :style="{ width: getOccupancy(garage.id_garage) + '%' }"
                     :class="{ 'fill-warn': getOccupancy(garage.id_garage) > 80 }"
                   ></div>
                 </div>
                 <span class="occupancy-pct">{{ getOccupancy(garage.id_garage) }}%</span>
               </div>


               <div class="stato-meta">
                 <span>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                   {{ garage.is24h ? 'Aperto 24h' : `${garage.orarioapertura?.substring(0,5)} – ${garage.orariochiusura?.substring(0,5)}` }}
                 </span>
                 <span>€ {{ garage.tariffabase }}/h</span>
               </div>
             </div>
           </div>


           <div v-if="allerteStato.length > 0" class="section-header" style="margin-top: 32px;">
             <h2>Allerte</h2>
           </div>
           <div v-for="allerta in allerteStato" :key="allerta.id" :class="['allerta-card', allerta.tipo === 'warning' ? 'allerta--warn' : 'allerta--danger']">
             <div class="allerta-icon">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
             </div>
             <div>
               <p class="allerta-title">{{ allerta.titolo }}</p>
               <p class="allerta-msg">{{ allerta.messaggio }}</p>
             </div>
           </div>


           <div v-if="allerteStato.length === 0 && mieiGarage.length > 0" class="allerta-card allerta--ok" style="margin-top: 24px;">
             <div class="allerta-icon">
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
             </div>
             <div>
               <p class="allerta-title">Tutto regolare</p>
               <p class="allerta-msg">Tutti i garage operano nei limiti normali.</p>
             </div>
           </div>
         </section>


         <!-- STORICO -->
         <section v-if="vistaAttiva === 'storico'" class="vista fade-in">
           <div class="page-header">
             <div>
               <h1>Storico Prenotazioni</h1>
               <p class="subtitle">Tutte le prenotazioni dei tuoi garage</p>
             </div>
           </div>


           <div class="table-card">
             <table class="parkly-table">
               <thead>
                 <tr>
                   <th>Codice</th>
                   <th>Garage</th>
                   <th>Targa</th>
                   <th>Inizio</th>
                   <th>Fine</th>
                   <th>Importo</th>
                   <th>Stato</th>
                 </tr>
               </thead>
               <tbody>
                 <tr v-for="p in storicoPrenotazioni" :key="p.id_prenotazione">
                   <td><span class="targa-badge">{{ p.codiceprenotazione }}</span></td>
                   <td class="td-bold">{{ p.nome_garage }}</td>
                   <td><span class="targa-badge">{{ p.targa }}</span></td>
                   <td class="td-muted">{{ formatData(p.iniziososta) }}</td>
                   <td class="td-muted">{{ formatData(p.finesosta) }}</td>
                   <td class="td-bold td-blue">€ {{ p.prezzototale }}</td>
                   <td>
                     <span :class="['badge', statoBadge(p.stato)]">{{ p.stato }}</span>
                   </td>
                 </tr>
                 <tr v-if="storicoPrenotazioni.length === 0">
                   <td colspan="7" class="td-empty">Nessuna prenotazione trovata.</td>
                 </tr>
               </tbody>
             </table>
           </div>
         </section>


         <!-- AGGIUNGI GARAGE -->
         <section v-if="vistaAttiva === 'aggiungi'" class="vista fade-in">
           <div class="page-header">
             <div>
               <h1>Pubblica un Garage</h1>
               <p class="subtitle">Compila i dettagli per attivarlo nel sistema</p>
             </div>
           </div>


           <div class="form-card">
             <form @submit.prevent="salvaNuovoGarage">


               <div class="form-row">
                 <div class="form-group">
                   <label class="form-label">Nome del Garage</label>
                   <input type="text" class="form-input" v-model="nuovoGarage.nome" required placeholder="Es. Garage Roma Centro">
                 </div>
               </div>


               <div class="form-row">
                 <div class="form-group">
                   <label class="form-label">Indirizzo Completo</label>
                   <input type="text" class="form-input" v-model="nuovoGarage.indirizzo" required placeholder="Es. Via Roma 10, Roma">
                 </div>
               </div>


               <div class="form-row">
                 <div class="form-group">
                   <label class="form-label">Descrizione</label>
                   <input type="text" class="form-input" v-model="nuovoGarage.descrizione" placeholder="Breve descrizione del garage">
                 </div>
               </div>


               <div class="form-row form-row--2col">
                 <div class="form-group">
                   <label class="form-label">Tariffa Base (€/h)</label>
                   <input type="number" step="0.50" class="form-input" v-model="nuovoGarage.tariffabase" required min="0">
                 </div>
                 <div class="form-group">
                   <label class="form-label">Altezza Massima (m)</label>
                   <input type="number" step="0.10" class="form-input" v-model="nuovoGarage.altezzamassima" min="0">
                 </div>
               </div>


               <div class="form-row form-row--2col">
                 <div class="form-group">
                   <label class="form-label">Orario Apertura</label>
                   <input type="time" class="form-input" v-model="nuovoGarage.orarioapertura" :disabled="nuovoGarage.is24h">
                 </div>
                 <div class="form-group">
                   <label class="form-label">Orario Chiusura</label>
                   <input type="time" class="form-input" v-model="nuovoGarage.orariochiusura" :disabled="nuovoGarage.is24h">
                 </div>
               </div>


               <div class="form-row">
                 <label class="checkbox-label">
                   <input type="checkbox" v-model="nuovoGarage.is24h" class="checkbox-input">
                   <span>Aperto 24 ore su 24</span>
                 </label>
               </div>


               <div class="form-row">
                 <div class="form-group">
                   <label class="form-label">Planimetria (.txt)</label>
                   <input type="file" accept=".txt" class="form-input form-input--file" @change="caricaPlanimetria">
                   <span class="form-hint">Carica la planimetria del garage in formato testo.</span>
                 </div>
               </div>


               <div v-if="erroreForm" class="form-error">{{ erroreForm }}</div>


               <div class="form-actions">
                 <button type="submit" class="btn-primary" :disabled="staSalvando">
                   {{ staSalvando ? 'Salvataggio in corso...' : 'Pubblica Garage' }}
                 </button>
               </div>


             </form>
           </div>
         </section>


       </template>
     </main>
   </div>


   <Footer />
 </div>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue'
import { authStore } from '../store/auth.js'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'


// ── AUTH GUARD ────────────────────────────────────────────────
// Legge il ruolo direttamente dall'utente nello store (impostato al login dall'Header)
const isGestore = computed(() => authStore.utente?.ruolo === 'GESTORE')


// ── STATE ─────────────────────────────────────────────────────
const vistaAttiva = ref('statistiche')
const isLoading   = ref(false)
const staSalvando = ref(false)
const erroreForm  = ref('')


const mieiGarage           = ref([])
const storicoPrenotazioni   = ref([])
const allerteStato          = ref([])
const occupazioneGarage     = ref({})  // { id_garage: percentuale_int }


const nuovoGarage = ref({
 nome: '', indirizzo: '', descrizione: '',
 tariffabase: null, altezzamassima: null,
 orarioapertura: '08:00', orariochiusura: '20:00',
 is24h: false, mappatestuale: ''
})


// ── COMPUTED ──────────────────────────────────────────────────


// Somma importi del mese corrente escludendo ANNULLATE
const guadagnoMese = computed(() => {
 const ora = new Date()
 return storicoPrenotazioni.value
   .filter(p => {
     if (p.stato === 'ANNULLATA') return false
     const d = new Date(p.iniziososta)
     return d.getMonth() === ora.getMonth() && d.getFullYear() === ora.getFullYear()
   })
   .reduce((acc, p) => acc + parseFloat(p.prezzototale || 0), 0)
   .toFixed(2)
})


const prenotazioniAttive = computed(() =>
 storicoPrenotazioni.value.filter(p => p.stato === 'ATTIVA').length
)


// ── HELPERS ───────────────────────────────────────────────────
const getOccupancy = (idGarage) => occupazioneGarage.value[idGarage] ?? 0


const formatData = (iso) => {
 if (!iso) return '—'
 const d = new Date(iso)
 return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}


const statoBadge = (stato) => {
 if (stato === 'ATTIVA')    return 'badge--green'
 if (stato === 'ANNULLATA') return 'badge--red'
 return 'badge--gray'
}


// ── API CALLS ─────────────────────────────────────────────────
const caricaDati = async () => {
 if (!isGestore.value) return
 isLoading.value = true
 try {
   await Promise.all([caricaGarage(), caricaStorico(), caricaStato()])
 } finally {
   isLoading.value = false
 }
}


const caricaGarage = async () => {
 const res = await fetch('/api/garages-gestore', { credentials: 'include' })
 if (!res.ok) return
 const data = await res.json()
 mieiGarage.value = data


 // Occupazione per ogni garage (endpoint separato se esiste, altrimenti 0)
 await Promise.all(data.map(async (g) => {
   try {
     const r = await fetch(`/api/garages/${g.id_garage}/occupazione`, { credentials: 'include' })
     if (r.ok) {
       const { percentuale } = await r.json()
       occupazioneGarage.value[g.id_garage] = Math.round(percentuale)
     }
   } catch { /* endpoint opzionale */ }
 }))
}


const caricaStorico = async () => {
 // L'endpoint deve restituire le prenotazioni di tutti i garage del gestore loggato
 // con i campi: id_prenotazione, codiceprenotazione, nome_garage, targa,
 //             iniziososta, finesosta, prezzototale, stato
 const res = await fetch('/api/prenotazioni-gestore', { credentials: 'include' })
 if (res.ok) storicoPrenotazioni.value = await res.json()
}


const caricaStato = async () => {
 const res = await fetch('/api/stato-garages-gestore', { credentials: 'include' })
 if (res.ok) allerteStato.value = await res.json()
}


const caricaPlanimetria = (event) => {
 const file = event.target.files[0]
 if (!file) return
 const reader = new FileReader()
 reader.onload = (e) => { nuovoGarage.value.mappatestuale = e.target.result }
 reader.readAsText(file)
}


const salvaNuovoGarage = async () => {
 erroreForm.value = ''
 staSalvando.value = true
 try {
   const res = await fetch('/api/garages-gestore', {
     method: 'POST',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(nuovoGarage.value)
   })
   if (res.ok) {
     nuovoGarage.value = {
       nome: '', indirizzo: '', descrizione: '',
       tariffabase: null, altezzamassima: null,
       orarioapertura: '08:00', orariochiusura: '20:00',
       is24h: false, mappatestuale: ''
     }
     await caricaGarage()
     vistaAttiva.value = 'statistiche'
   } else {
     const err = await res.json().catch(() => ({}))
     erroreForm.value = err.error || 'Errore durante il salvataggio.'
   }
 } catch {
   erroreForm.value = 'Errore di rete.'
 } finally {
   staSalvando.value = false
 }
}


onMounted(caricaDati)


// ── NAV ITEMS ─────────────────────────────────────────────────
const navItems = [
 { id: 'statistiche', label: 'Statistiche',    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>` },
 { id: 'stato',       label: 'Stato Corrente', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>` },
 { id: 'storico',     label: 'Storico',         icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>` },
 { id: 'aggiungi',    label: 'Aggiungi Garage', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` },
]
</script>


<style scoped>
/* ── LAYOUT ─────────────────────────────────────────────────── */
.page-wrapper {
 display: flex;
 flex-direction: column;
 min-height: 100vh;
 background-color: var(--bg-light, #F5F5F3);
 font-family: 'Inter', -apple-system, sans-serif;
}
.dashboard-layout { display: flex; flex: 1; }


/* ── ACCESS DENIED ──────────────────────────────────────────── */
.access-denied {
 flex: 1;
 display: flex;
 flex-direction: column;
 align-items: center;
 justify-content: center;
 gap: 12px;
 padding: 80px 20px;
 color: #aaa;
 text-align: center;
}
.access-denied svg { color: #ddd; }
.access-denied h2  { font-size: 1.4rem; color: #444; margin: 0; }
.access-denied p   { font-size: 0.9rem; color: #888; max-width: 380px; margin: 0; }
.btn-back {
 margin-top: 8px;
 display: inline-block;
 padding: 10px 24px;
 background: #0066CC;
 color: #fff;
 border-radius: 8px;
 text-decoration: none;
 font-size: 0.875rem;
 font-weight: 600;
 transition: background 0.15s;
}
.btn-back:hover { background: #00204A; }


/* ── SIDEBAR ────────────────────────────────────────────────── */
.sidebar {
 width: 240px;
 min-width: 240px;
 background-color: var(--deep-blue, #00204A);
 display: flex;
 flex-direction: column;
 padding: 28px 16px 20px;
}
.sidebar-brand {
 display: flex;
 align-items: center;
 gap: 10px;
 color: rgba(255,255,255,0.9);
 font-size: 0.95rem;
 font-weight: 600;
 padding: 0 8px 20px;
 border-bottom: 1px solid rgba(255,255,255,0.08);
 margin-bottom: 12px;
}
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.nav-item {
 position: relative;
 display: flex;
 align-items: center;
 gap: 10px;
 padding: 10px 12px;
 border-radius: 8px;
 color: rgba(255,255,255,0.5);
 text-decoration: none;
 font-size: 0.875rem;
 font-weight: 500;
 transition: background 0.15s, color 0.15s;
}
.nav-item:hover  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
.nav-item.active { background: rgba(255,255,255,0.1); color: #fff; }
.nav-indicator   { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; background: #0066CC; border-radius: 0 2px 2px 0; }
.nav-icon        { display: flex; align-items: center; flex-shrink: 0; }


.sidebar-user {
 display: flex;
 align-items: center;
 gap: 10px;
 padding: 14px 8px 0;
 border-top: 1px solid rgba(255,255,255,0.08);
 margin-top: 16px;
}
.sidebar-avatar    { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.15); flex-shrink: 0; }
.sidebar-user-info { display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
.sidebar-user-name { font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-user-role { font-size: 0.7rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.06em; }


/* ── MAIN ───────────────────────────────────────────────────── */
.main-content { flex: 1; padding: 40px 48px; overflow-y: auto; }


/* ── LOADING ────────────────────────────────────────────────── */
.loading-state {
 display: flex; flex-direction: column; align-items: center;
 justify-content: center; gap: 16px; min-height: 300px;
 color: #aaa; font-size: 0.875rem;
}
.spinner {
 width: 32px; height: 32px;
 border: 3px solid #E8E8E8;
 border-top-color: #0066CC;
 border-radius: 50%;
 animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }


/* ── ANIMATIONS ─────────────────────────────────────────────── */
.vista { animation: fadeIn 0.25s ease; }
@keyframes fadeIn {
 from { opacity: 0; transform: translateY(8px); }
 to   { opacity: 1; transform: translateY(0); }
}


/* ── PAGE HEADER ────────────────────────────────────────────── */
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 1.6rem; font-weight: 700; color: var(--deep-blue, #00204A); letter-spacing: -0.5px; margin: 0 0 4px; }
.subtitle { font-size: 0.875rem; color: #888; margin: 0; }


/* ── STAT CARDS ─────────────────────────────────────────────── */
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
.stat-card { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon--blue  { background: #EBF3FF; color: #0066CC; }
.stat-icon--green { background: #EAFAF1; color: #27AE60; }
.stat-icon--amber { background: #FEF9EE; color: #E67E22; }
.stat-body  { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 0.72rem; color: #999; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--deep-blue, #00204A); letter-spacing: -0.5px; line-height: 1; }


/* ── SECTION HEADER ─────────────────────────────────────────── */
.section-header { margin-bottom: 12px; }
.section-header h2 { font-size: 1rem; font-weight: 600; color: var(--deep-blue, #00204A); }


/* ── TABLE ──────────────────────────────────────────────────── */
.table-card { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; overflow: hidden; }
.parkly-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.parkly-table thead tr { background: #FAFAFA; border-bottom: 0.5px solid #EFEFEF; }
.parkly-table th { padding: 12px 20px; text-align: left; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #aaa; }
.parkly-table tbody tr { border-bottom: 0.5px solid #F5F5F5; transition: background 0.1s; }
.parkly-table tbody tr:last-child { border-bottom: none; }
.parkly-table tbody tr:hover { background: #FAFBFF; }
.parkly-table td { padding: 14px 20px; color: #444; }
.td-muted { color: #bbb; font-size: 0.8rem; }
.td-bold  { font-weight: 600; color: #222; }
.td-blue  { color: #0066CC; }
.td-empty { text-align: center; padding: 40px; color: #ccc; font-size: 0.85rem; }


/* ── BADGES ─────────────────────────────────────────────────── */
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.badge--green { background: #EAFAF1; color: #1E8449; }
.badge--red   { background: #FDEDEC; color: #C0392B; }
.badge--gray  { background: #F0F0F0; color: #888; }
.targa-badge  { display: inline-block; background: #F5F5F5; border: 0.5px solid #E0E0E0; border-radius: 4px; padding: 2px 8px; font-size: 0.78rem; font-weight: 600; font-family: 'Courier New', monospace; color: #444; letter-spacing: 0.06em; }


/* ── STATO CORRENTE ─────────────────────────────────────────── */
.stato-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.stato-card { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 20px; }
.stato-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.stato-nome      { font-size: 0.9rem; font-weight: 600; color: #222; }
.stato-indirizzo { font-size: 0.78rem; color: #aaa; margin: 0 0 16px; }
.occupancy-wrap  { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.occupancy-bar   { flex: 1; height: 6px; background: #F0F0F0; border-radius: 999px; overflow: hidden; }
.occupancy-fill  { height: 100%; background: #0066CC; border-radius: 999px; transition: width 0.4s ease; }
.occupancy-fill.fill-warn { background: #E67E22; }
.occupancy-pct   { font-size: 0.78rem; color: #888; font-weight: 600; min-width: 34px; text-align: right; }
.stato-meta      { display: flex; justify-content: space-between; font-size: 0.75rem; color: #aaa; }
.stato-meta span { display: flex; align-items: center; gap: 4px; }


/* ── ALLERTE ────────────────────────────────────────────────── */
.allerta-card { display: flex; align-items: flex-start; gap: 16px; padding: 20px 24px; border-radius: 12px; margin-bottom: 12px; border: 0.5px solid transparent; }
.allerta--ok     { background: #EAFAF1; border-color: #A9DFBF; }
.allerta--ok .allerta-icon { color: #27AE60; }
.allerta--warn   { background: #FEF9EE; border-color: #FAD7A0; }
.allerta--warn .allerta-icon { color: #E67E22; }
.allerta--danger { background: #FDEDEC; border-color: #F1948A; }
.allerta--danger .allerta-icon { color: #C0392B; }
.allerta-icon  { display: flex; align-items: center; margin-top: 1px; flex-shrink: 0; }
.allerta-title { font-size: 0.9rem; font-weight: 600; color: #222; margin: 0 0 4px; }
.allerta-msg   { font-size: 0.85rem; color: #666; margin: 0; line-height: 1.5; }


/* ── FORM ───────────────────────────────────────────────────── */
.form-card { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 32px; max-width: 620px; }
.form-row       { margin-bottom: 20px; }
.form-row--2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.form-group     { display: flex; flex-direction: column; gap: 6px; }
.form-label     { font-size: 0.75rem; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
.form-input {
 height: 48px; border: 0.5px solid #E0E0E0; border-radius: 8px;
 padding: 0 14px; font-size: 0.9rem; color: #222; background: #FAFAFA;
 outline: none; font-family: inherit; transition: border-color 0.15s, background 0.15s;
 width: 100%; box-sizing: border-box;
}
.form-input:focus    { border-color: #0066CC; background: #fff; box-shadow: 0 0 0 3px rgba(0,102,204,0.08); }
.form-input:disabled { opacity: 0.4; cursor: not-allowed; }
.form-input--file    { height: auto; padding: 10px 14px; cursor: pointer; }
.form-hint { font-size: 0.78rem; color: #aaa; }
.checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 0.875rem; color: #444; cursor: pointer; }
.checkbox-input { width: 16px; height: 16px; accent-color: #0066CC; cursor: pointer; }
.form-error { background: #FDEDEC; border: 0.5px solid #F1948A; border-radius: 8px; padding: 10px 16px; font-size: 0.85rem; color: #C0392B; margin-bottom: 16px; }
.form-actions { margin-top: 28px; padding-top: 24px; border-top: 0.5px solid #F0F0F0; }
.btn-primary { background: #0066CC; color: #fff; border: none; border-radius: 8px; height: 48px; padding: 0 32px; font-size: 0.9rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s, transform 0.1s; }
.btn-primary:hover:not(:disabled) { background: #00204A; transform: translateY(-1px); }
.btn-primary:disabled { background: #ccc; cursor: not-allowed; }


/* ── RESPONSIVE ─────────────────────────────────────────────── */
@media (max-width: 900px) {
 .sidebar { display: none; }
 .main-content { padding: 24px 20px; }
 .stats-grid { grid-template-columns: 1fr; }
 .form-row--2col { grid-template-columns: 1fr; }
 .stato-grid { grid-template-columns: 1fr; }
}
</style>

