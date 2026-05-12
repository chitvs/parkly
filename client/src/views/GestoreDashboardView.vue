<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { authStore } from '../store/auth.js'
import { walletStore } from '../store/wallet.js'
import { garageStore } from '../store/garage.js'
import * as bootstrap from 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'

import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import ChatBox from '../components/ChatBox.vue'
import { getSocket } from '../composables/useChat.js'

import DashboardStats from '../components/gestore/DashboardStats.vue'
import DashboardGarageList from '../components/gestore/DashboardGarageList.vue'
import DashboardStato from '../components/gestore/DashboardStato.vue'
import DashboardStorico from '../components/gestore/DashboardStorico.vue'
import DashboardGarageForm from '../components/gestore/DashboardGarageForm.vue'

const isGestore = computed(() => authStore.utente?.ruolo === 'GESTORE')

const vistaAttiva = ref('statistiche')
const isLoading = ref(false)
const staSalvando = ref(false)
const messaggio = ref(null)

const mieiGarage = ref([])
const storicoPrenotazioni = ref([])
const allerteStato = ref([])
const occupazioneGarage = ref({})
const postiPerGarage = ref({})
const reRenderKey = ref(0)

const formattaPerInputDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const chatSelezionata = ref(null)
let socket = null

const handleNuovoMessaggio = (msg) => {
  const prenotazione = storicoPrenotazioni.value.find(p => Number(p.id_prenotazione) === Number(msg.id_prenotazione))
  if (prenotazione) {
    const chatAperta = chatSelezionata.value && chatSelezionata.value.idPrenotazione === Number(msg.id_prenotazione)
    if (!chatAperta) prenotazione.nonletti = (prenotazione.nonletti || 0) + 1
  }
}

const apriChat = async (prenotazione) => {
  const idGarage = Number(prenotazione.id_garage)
  const idCliente = Number(prenotazione.id_utente)
  if (!idGarage || !idCliente || isNaN(idGarage) || isNaN(idCliente)) return

  prenotazione.nonletti = 0
  chatSelezionata.value = null
  await nextTick()
  chatSelezionata.value = {
    idPrenotazione: Number(prenotazione.id_prenotazione),
    idGarage,
    idDestinatario: idCliente,
    nomeDestinatario: prenotazione.nomecliente ? prenotazione.nomecliente + ' ' + (prenotazione.cognomecliente || '') : 'Cliente'
  }
}

const chiudiChat = () => { chatSelezionata.value = null }

const isEditing = ref(false)
const idGarageInModifica = ref(null)
const garageInModifica = ref(null)

const preparaModifica = async (garage) => {
  messaggio.value = null
  const res = await fetch(`/api/garage/${garage.id_garage}/posti`, { credentials: 'include' })
  const data = await res.json()

  garageInModifica.value = {
    ...garage,
    posti_raw: data.success ? data.posti : []
  }

  isEditing.value = true
  idGarageInModifica.value = garage.id_garage
  vistaAttiva.value = 'aggiungi'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const salvaNuovoGarage = async (payload) => {
  messaggio.value = null
  staSalvando.value = true

  let res;
  if (isEditing.value) {
    res = await garageStore.updateGarage(idGarageInModifica.value, payload)
  } else {
    const raw = await fetch('/api/garage/garages-gestore', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    res = await raw.json()
  }

  if (res.success) {
    isEditing.value = false
    idGarageInModifica.value = null
    garageInModifica.value = null
    await caricaGarage()
    messaggio.value = { tipo: 'success', testo: isEditing.value ? 'Garage aggiornato!' : 'Garage pubblicato!' }
    vistaAttiva.value = 'garage'
  } else {
    messaggio.value = { tipo: 'error', testo: res.error || 'Errore durante il salvataggio' }
  }
  staSalvando.value = false
}

const caricaGarage = async () => {
  const res = await fetch('/api/garage/garages-gestore', { credentials: 'include' })
  if (!res.ok) return
  const data = await res.json()

  const nuoviPosti = {}
  const nuovaOccupazione = {}

  await Promise.all(data.map(async (g) => {
    try {
      const [rPosti, rOcc] = await Promise.all([
        fetch(`/api/garage/${g.id_garage}/posti`, { credentials: 'include' }),
        fetch(`/api/garage/${g.id_garage}/occupazione`, { credentials: 'include' })
      ])
      if (rPosti.ok) nuoviPosti[g.id_garage] = (await rPosti.json()).posti
      if (rOcc.ok) nuovaOccupazione[g.id_garage] = Math.round((await rOcc.json()).percentuale)
    } catch (e) { console.error(e) }
  }))

  postiPerGarage.value = nuoviPosti
  occupazioneGarage.value = nuovaOccupazione
  mieiGarage.value = data
  reRenderKey.value++
}

const aggiornaMappaOrari = async ({ inizio, fine }) => {
  const iIso = new Date(inizio).toISOString()
  const fIso = new Date(fine).toISOString()
  await Promise.all(mieiGarage.value.map(async (g) => {
    try {
      const r = await fetch(`/api/garage/${g.id_garage}/posti?inizio=${iIso}&fine=${fIso}`, { credentials: 'include' })
      if (r.ok) postiPerGarage.value[g.id_garage] = (await r.json()).posti
    } catch (e) { console.error(e) }
  }))
  reRenderKey.value++
}

const caricaStorico = async () => {
  const res = await fetch('/api/prenotazioni/prenotazioni-gestore', { credentials: 'include' })
  if (res.ok) storicoPrenotazioni.value = await res.json()
}

const caricaStato = async () => {
  const res = await fetch('/api/garage/stato-garages-gestore', { credentials: 'include' })
  if (res.ok) allerteStato.value = await res.json()
}

const infoModalElement = ref(null)
let infoModalInstance = null
const openInfoModal = () => { if (infoModalInstance) infoModalInstance.show() }

const showMaintenanceModal = ref(false)
const postoDaGestire = ref(null)
const manutenzioneData = ref({ inizio: '', fine: '', motivazione: '' })

const apriGestionePosto = (posto) => {
  postoDaGestire.value = posto
  manutenzioneData.value = {
    inizio: formattaPerInputDate(new Date()) + 'T08:00',
    fine: formattaPerInputDate(new Date()) + 'T20:00',
    motivazione: ''
  }
  showMaintenanceModal.value = true
}

const salvaManutenzione = async () => {
  const res = await garageStore.addMaintenance(postoDaGestire.value.id_garage, postoDaGestire.value.id_posto, manutenzioneData.value)
  if (res.success) {
    showMaintenanceModal.value = false
    messaggio.value = { tipo: 'success', testo: res.message }
    await caricaGarage()
  } else {
    alert(res.error)
  }
}

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      walletStore.contabilizzaRicavi(),
      walletStore.caricaSaldoSospeso(),
      caricaGarage(),
      caricaStorico(),
      caricaStato()
    ])
    if (mieiGarage.value.length === 0) vistaAttiva.value = 'aggiungi'
    else vistaAttiva.value = 'statistiche'
  } finally {
    isLoading.value = false
  }

  if (infoModalElement.value) infoModalInstance = new bootstrap.Modal(infoModalElement.value)
  socket = getSocket()
  socket.on('nuovo_messaggio', handleNuovoMessaggio)
})

onUnmounted(() => {
  if (infoModalInstance) infoModalInstance.dispose()
  if (socket) socket.off('nuovo_messaggio', handleNuovoMessaggio)
})

watch(vistaAttiva, (newVal) => {
  messaggio.value = null
  if (newVal !== 'aggiungi') {
    idGarageInModifica.value = null
    garageInModifica.value = null
    isEditing.value = false
  }
})

const navItems = [
  { id: 'statistiche', label: 'Statistiche', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>' },
  { id: 'garage', label: 'I miei Garage', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
  { id: 'stato', label: 'Stato Corrente', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { id: 'storico', label: 'Storico', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { id: 'aggiungi', label: 'Aggiungi Garage', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
]

const menuFiltrato = computed(() => mieiGarage.value.length === 0 ? navItems.filter(i => i.id === 'aggiungi') : navItems)
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <div v-if="!isGestore" class="access-denied">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      <h2>Accesso negato</h2>
      <p>Questa area è riservata ai gestori. Effettua il login con un account gestore.</p>
      <RouterLink to="/" class="btn-back">Torna alla Home</RouterLink>
    </div>

    <div v-else class="dashboard-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
          <span>Area Gestore</span>
        </div>
        <nav class="sidebar-nav">
          <a v-for="item in menuFiltrato" :key="item.id" href="#"
            :class="['nav-item', { active: vistaAttiva === item.id }]" @click.prevent="vistaAttiva = item.id">
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="vistaAttiva === item.id" class="nav-indicator"></span>
          </a>
        </nav>
        <div class="sidebar-user">
          <img :src="authStore.utente?.fotoProfilo_URL || '/default-avatar.png'" alt="Avatar" class="sidebar-avatar" />
          <div class="sidebar-user-info">
            <span class="sidebar-user-name">{{ authStore.utente?.nome }} {{ authStore.utente?.cognome }}</span>
            <span class="sidebar-user-role">Gestore</span>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>Caricamento dati...</span>
        </div>

        <template v-else>
          <div v-if="messaggio" :class="['alert', messaggio.tipo, 'mb-4']"
            style="max-width: 960px; margin-left: auto; margin-right: auto;">
            {{ messaggio.testo }}
            <button @click="messaggio = null" class="close-btn">×</button>
          </div>

          <DashboardStats v-if="vistaAttiva === 'statistiche'" :miei-garage="mieiGarage"
            :storico-prenotazioni="storicoPrenotazioni" />

          <DashboardGarageList v-if="vistaAttiva === 'garage'" :miei-garage="mieiGarage" @modifica="preparaModifica" />

          <DashboardStato v-if="vistaAttiva === 'stato'" :key="'stato-' + reRenderKey" :miei-garage="mieiGarage"
            :posti-per-garage="postiPerGarage" :occupazione-garage="occupazioneGarage" :allerte-stato="allerteStato"
            @verifica-disponibilita="aggiornaMappaOrari" @manage-posto="apriGestionePosto" />

          <DashboardStorico v-if="vistaAttiva === 'storico'" :prenotazioni="storicoPrenotazioni"
            @apri-chat="apriChat" />

          <DashboardGarageForm v-if="vistaAttiva === 'aggiungi'" :is-editing="isEditing" :garage-data="garageInModifica"
            :sta-salvando="staSalvando" @save="salvaNuovoGarage" @open-info="openInfoModal" />
        </template>
      </main>
    </div>

    <div class="modal fade" id="infoModal" ref="infoModalElement" tabindex="-1" aria-labelledby="infoModalLabel"
      aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content parkly-modal">
          <div class="modal-header border-0">
            <h5 class="modal-title modal-title-text" id="infoModalLabel">
              <i class="bi bi-info-circle me-2"></i>Guida alla pubblicazione
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-4 pb-4 pt-0">
            <ul class="info-list">
              <li>Cerca il tuo indirizzo per avvicinarti, poi clicca sulla mappa interattiva per posizionare il pin
                esattamente sopra il tuo garage.</li>
              <li>Configura la tipologia del posto (Auto, Moto, Furgone) e aggiungi servizi extra. Il codice verrà
                generato
                in automatico se lasciato vuoto.</li>
              <li>Una volta creati i posti, selezionali dalla tavolozza e clicca sulla griglia a scacchiera per
                disegnare
                visivamente il layout reale del garage.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div v-if="chatSelezionata" class="chat-popup-container">
      <ChatBox @chiudi="chiudiChat" :idPrenotazione="chatSelezionata.idPrenotazione"
        :idGarage="chatSelezionata.idGarage" :idDestinatario="chatSelezionata.idDestinatario"
        :nomeDestinatario="chatSelezionata.nomeDestinatario" ruoloDestinatario="Cliente" />
    </div>

    <div v-if="showMaintenanceModal" class="custom-modal-overlay">
      <div class="custom-modal shadow-lg">
        <div class="modal-header border-0 pb-0">
          <h3 class="modal-title h5">Gestione Posto {{ postoDaGestire?.codiceposto }}</h3>
          <button @click="showMaintenanceModal = false" class="btn-close"></button>
        </div>
        <div class="modal-body pt-2">
          <p class="text-muted small mb-4">Seleziona il periodo in cui il posto non sarà disponibile per la sosta.</p>
          <div class="form-group mb-3">
            <label class="form-label">Inizio Blocco</label>
            <input type="datetime-local" v-model="manutenzioneData.inizio" class="form-input">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Fine Blocco</label>
            <input type="datetime-local" v-model="manutenzioneData.fine" class="form-input">
          </div>
          <div class="form-group mb-4">
            <label class="form-label">Motivazione (Opzionale)</label>
            <textarea v-model="manutenzioneData.motivazione" class="form-input"
              placeholder="Es. Manutenzione ordinaria, colonnina guasta..." rows="2"></textarea>
          </div>
          <div class="d-flex gap-2">
            <button @click="salvaManutenzione" class="btn-primary flex-grow-1">Conferma Blocco</button>
            <button @click="showMaintenanceModal = false" class="btn-secondary">Annulla</button>
          </div>
        </div>
      </div>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
/* ── Mantenuto SOLO il CSS globale di layout. Il resto è nei componenti figli ── */
.page-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-light, #F5F5F3);
  font-family: 'Inter', -apple-system, sans-serif;
}

.dashboard-layout {
  display: flex;
  flex: 1;
}

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

.access-denied svg {
  color: #ddd;
}

.access-denied h2 {
  font-size: 1.4rem;
  color: #444;
  margin: 0;
}

.access-denied p {
  font-size: 0.9rem;
  color: #888;
  max-width: 380px;
  margin: 0;
}

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

.btn-back:hover {
  background: #00204A;
}

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
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0 8px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  background: #0066CC;
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 16px;
}

.sidebar-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.sidebar-user-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.sidebar-user-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-role {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.main-content {
  flex: 1;
  padding: 40px 48px;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 300px;
  color: #aaa;
  font-size: 0.875rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E8E8E8;
  border-top-color: #0066CC;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alert.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.alert.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.4;
  font-size: 1.1rem;
  line-height: 1;
}

.chat-popup-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 350px;
  max-width: calc(100vw - 48px);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.parkly-modal {
  border-radius: 24px;
  border: none;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
}

.modal-title-text {
  font-weight: 700;
  color: #00408a;
  font-size: 1.3rem;
}

.info-list {
  padding-left: 20px;
  color: #444;
  font-size: 0.95rem;
  line-height: 1.6;
}

.info-list li {
  margin-bottom: 12px;
}

.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.custom-modal {
  background: #fff;
  padding: 24px;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  position: relative;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.form-input {
  height: 48px;
  border: 0.5px solid #E0E0E0;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}

.btn-primary {
  background: #0066CC;
  color: #fff;
  border: none;
  border-radius: 8px;
  height: 48px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s;
}

.btn-secondary {
  background: #fff;
  border: 1px solid #0066CC;
  color: #0066CC;
  height: 48px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 900px) {
  .sidebar {
    display: none;
  }

  .main-content {
    padding: 24px 20px;
  }
}
</style>