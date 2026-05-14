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

// foto profilo standard
import defaultAvatarUrl from '../assets/default-avatar.png'

// Componenti Dashboard
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
const reRenderKey = ref(0)

// Collegamenti ai dati del Pinia Store
const mieiGarage = computed(() => garageStore.mieiGarage || [])
const storicoPrenotazioni = computed(() => garageStore.storicoPrenotazioni || [])
const postiPerGarage = computed(() => garageStore.postiPerGarage || {})
const occupazioneGarage = computed(() => garageStore.occupazioneGarage || {})
const allerteStato = computed(() => garageStore.allerteStato || [])

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

// Ricevitore per le foto caricate nel form figlio
const fotoDaCaricare = ref([])

const handleFotoDalComponente = (files) => {
  fotoDaCaricare.value = files
}

const preparaModifica = async (garage) => {
  messaggio.value = null
  const res = await garageStore.fetchPosti(garage.id_garage)

  garageInModifica.value = {
    ...garage,
    posti_raw: res.success ? res.posti : []
  }

  isEditing.value = true
  idGarageInModifica.value = garage.id_garage
  vistaAttiva.value = 'aggiungi'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Logica Two-Step (Store Database + Foto Supabase)
const salvaNuovoGarage = async (payload) => {
  messaggio.value = null
  staSalvando.value = true

  try {
    // STEP 1: Creazione/Modifica Testo Garage tramite Store
    const res = isEditing.value
      ? await garageStore.updateGarage(idGarageInModifica.value, payload)
      : await garageStore.createGarage(payload)

    if (res.success || res.garage) { 
      // Otteniamo il nuovo ID in base a come lo store restituisce l'oggetto
      const nuovoIdGarage = isEditing.value ? idGarageInModifica.value : (res.garage?.id_garage || res.data?.id_garage)

      // STEP 2: Caricamento Immagini
      if (fotoDaCaricare.value.length > 0 && nuovoIdGarage) {
        const formData = new FormData()
        fotoDaCaricare.value.forEach(file => formData.append('foto_garage', file))

        const resFoto = await fetch(`/api/garage/${nuovoIdGarage}/upload-photos`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        })

        if (!resFoto.ok) {
          console.error("Errore durante l'upload delle foto su Supabase")
        }
      }

      // Pulizia form
      isEditing.value = false
      idGarageInModifica.value = null
      garageInModifica.value = null
      fotoDaCaricare.value = []

      // Refresh dei dati tramite store
      await garageStore.caricaDashboardGestore()
      messaggio.value = { tipo: 'success', testo: isEditing.value ? 'Garage aggiornato!' : 'Garage pubblicato!' }
      vistaAttiva.value = 'garage'
    } else {
      messaggio.value = { tipo: 'error', testo: res.error || 'Errore durante il salvataggio' }
    }
  } catch (e) {
    console.error(e)
    messaggio.value = { tipo: 'error', testo: 'Errore di rete o del server.' }
  } finally {
    staSalvando.value = false
  }
}

const aggiornaMappaOrari = async ({ inizio, fine }) => {
  const iIso = new Date(inizio).toISOString()
  const fIso = new Date(fine).toISOString()
  await garageStore.aggiornaMappaOrariGestore(iIso, fIso)
}

const infoModalElement = ref(null)
let infoModalInstance = null
const openInfoModal = () => { if (infoModalInstance) infoModalInstance.show() }

const showMaintenanceModal = ref(false)
const postoDaGestire = ref(null)
const manutenzioneData = ref({ inizio: '', fine: '', motivazione: '' })
const currentMaintenanceStep = ref(1);

const apriGestionePosto = (posto) => {
  postoDaGestire.value = posto;
  currentMaintenanceStep.value = 1;
  manutenzioneData.value = {
    inizio: formattaPerInputDate(new Date()) + 'T08:00',
    fine: formattaPerInputDate(new Date()) + 'T20:00',
    motivazione: ''
  };
  showMaintenanceModal.value = true;
};

const salvaManutenzione = async () => {
  const res = await garageStore.addMaintenance(postoDaGestire.value.id_garage, postoDaGestire.value.id_posto, manutenzioneData.value)
  if (res.success) {
    showMaintenanceModal.value = false
    messaggio.value = { tipo: 'success', testo: res.message }
    await garageStore.caricaDashboardGestore()
  } else {
    alert(res.error)
  }
}

const rimuoviManutenzione = async () => {
  const idManutenzione = postoDaGestire.value?.manutenzione?.id_manutenzione;
  if (!idManutenzione) return;

  const res = await garageStore.removeMaintenance(postoDaGestire.value.id_garage, postoDaGestire.value.id_posto, idManutenzione);

  if (res.success) {
    showMaintenanceModal.value = false;
    messaggio.value = { tipo: 'success', testo: res.message };
    await garageStore.caricaDashboardGestore()
  } else {
    alert(res.error);
  }
};

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      walletStore.contabilizzaRicavi(),
      walletStore.caricaSaldoSospeso(),
      garageStore.caricaDashboardGestore(),
      garageStore.caricaStoricoGestore(),
    ])
    if (mieiGarage.value.length === 0) vistaAttiva.value = 'aggiungi'
    else vistaAttiva.value = 'statistiche'
  } finally {
    isLoading.value = false
  }

  if (infoModalElement.value) {
    infoModalInstance = new bootstrap.Modal(infoModalElement.value)
  }
  socket = getSocket()
  if(socket) socket.on('nuovo_messaggio', handleNuovoMessaggio)
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
  { id: 'storico', label: 'Storico Prenotazioni', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { id: 'aggiungi', label: 'Aggiungi Garage', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
]

const menuFiltrato = computed(() => mieiGarage.value.length === 0 ? navItems.filter(i => i.id === 'aggiungi') : navItems)

const prenotazioniPostoSelezionato = computed(() => {
  if (!postoDaGestire.value || !storicoPrenotazioni.value) return [];
  const oraAttuale = new Date();
  return storicoPrenotazioni.value
    .filter(p =>
      p.id_posto === postoDaGestire.value.id_posto &&
      p.stato === 'ATTIVA' &&
      new Date(p.finesosta) > oraAttuale
    )
    .sort((a, b) => new Date(a.iniziososta) - new Date(b.iniziososta));
});

const isManutenzioneValida = computed(() => {
  if (!manutenzioneData.value.inizio || !manutenzioneData.value.fine) return false;
  const inizio = new Date(manutenzioneData.value.inizio);
  const fine = new Date(manutenzioneData.value.fine);
  return fine > inizio;
});

const formattaDataLeggibile = (dataIso) => {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(new Date(dataIso));
};
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
          <img :src="authStore.utente?.fotoProfilo_URL || defaultAvatarUrl" alt="Avatar" class="sidebar-avatar" />
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

          <DashboardGarageForm 
            v-if="vistaAttiva === 'aggiungi'" 
            :is-editing="isEditing" 
            :garage-data="garageInModifica"
            :sta-salvando="staSalvando" 
            @save="salvaNuovoGarage" 
            @update-photos="handleFotoDalComponente"
            @open-info="openInfoModal" 
          />
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
              <li>Cerca il tuo indirizzo per avvicinarti, poi clicca sulla mappa interattiva per posizionare il pin esattamente sopra il tuo garage.</li>
              <li>Configura la tipologia del posto (Auto, Moto, Furgone) e aggiungi servizi extra. Il codice verrà generato in automatico se lasciato vuoto.</li>
              <li>Una volta creati i posti, selezionali dalla tavolozza e clicca sulla griglia a scacchiera per disegnare visivamente il layout reale del garage.</li>
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

    <Transition name="overlay-fade">
      <div v-if="showMaintenanceModal" class="review-overlay" @click.self="showMaintenanceModal = false">
        <Transition name="modal-slide" appear>
          <div class="review-modal">

            <div class="review-topbar">
              <div class="step-track" v-if="!postoDaGestire?.is_in_manutenzione">
                <span :class="['step-pip', currentMaintenanceStep >= 1 ? 'step-pip--on' : '']"></span>
                <span :class="['step-pip', currentMaintenanceStep >= 2 ? 'step-pip--on' : '']"></span>
              </div>
              <div v-else></div> <button class="close-btn" @click="showMaintenanceModal = false">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>

            <div v-if="postoDaGestire?.is_in_manutenzione" class="step-wrapper fade-in">
              <div class="review-body pt-2">
                <span class="garage-chip">Posto {{ postoDaGestire?.codiceposto }}</span>
                <h3 class="modal-title">Manutenzione in corso</h3>
                <p class="modal-sub">Questo posto è bloccato e non è visibile ai clienti.</p>

                <div class="p-3 bg-light border rounded-3 mb-4">
                  <strong class="d-block mb-2 text-dark" style="font-size: 0.85rem; text-transform: uppercase;">Dettagli del blocco:</strong>
                  <div class="d-flex justify-content-between mb-1 small">
                    <span class="text-muted">Inizio:</span>
                    <span class="fw-bold">{{ formattaDataLeggibile(postoDaGestire.manutenzione?.inizio) }}</span>
                  </div>
                  <div class="d-flex justify-content-between mb-2 small">
                    <span class="text-muted">Fine:</span>
                    <span class="fw-bold text-danger">{{ formattaDataLeggibile(postoDaGestire.manutenzione?.fine) }}</span>
                  </div>
                  <div class="pt-2 mt-2 border-top small">
                    <span class="text-muted d-block mb-1">Motivazione:</span>
                    <span>{{ postoDaGestire.manutenzione?.motivazione || 'Nessuna motivazione specificata' }}</span>
                  </div>
                </div>
              </div>

              <div class="review-footer">
                <button class="cta-btn cta-btn--danger w-100" @click="rimuoviManutenzione">
                  <i class="bi bi-unlock-fill me-2"></i> Termina Manutenzione
                </button>
              </div>
            </div>

            <template v-else>
              <div v-if="currentMaintenanceStep === 1" class="step-wrapper fade-in">
                <div class="review-body pt-2">
                  <span class="garage-chip">Posto {{ postoDaGestire?.codiceposto }}</span>
                  <h3 class="modal-title">Verifica Disponibilità</h3>
                  <p class="modal-sub">Controlla le prenotazioni attive prima di programmare la manutenzione.</p>

                  <div class="mb-2">
                    <label class="field-label mb-2">Calendario Occupazione</label>
                    <div v-if="prenotazioniPostoSelezionato.length === 0" class="p-4 bg-light rounded-4 text-center border">
                      <i class="bi bi-calendar-check text-success fs-2 d-block mb-2"></i>
                      <span class="text-muted small">Nessun impegno futuro per questo posto.<br>Puoi procedere liberamente.</span>
                    </div>
                    <div v-else class="d-flex flex-column gap-2 pe-1">
                      <div v-for="pren in prenotazioniPostoSelezionato" :key="pren.id_prenotazione"
                        class="p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center">
                        <div>
                          <span class="fw-bold d-block text-dark small">{{ pren.targa || 'Targa N/D' }}</span>
                          <span class="text-muted extra-small">{{ formattaDataLeggibile(pren.iniziososta) }} - {{ formattaDataLeggibile(pren.finesosta) }}</span>
                        </div>
                        <span class="badge bg-primary-subtle text-primary rounded-pill px-2 py-1 extra-small">Prenotato</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="review-footer">
                  <button class="cta-btn cta-btn--primary w-100" @click="currentMaintenanceStep = 2">
                    Continua al blocco
                    <i class="bi bi-arrow-right ms-2"></i>
                  </button>
                </div>
              </div>

              <div v-if="currentMaintenanceStep === 2" class="step-wrapper fade-in">
                <div class="review-body pt-2">
                  <span class="garage-chip">Posto {{ postoDaGestire?.codiceposto }}</span>
                  <button class="back-btn mb-2 d-block" @click="currentMaintenanceStep = 1">
                    <i class="bi bi-arrow-left me-1"></i> Torna alla disponibilità
                  </button>
                  <h3 class="modal-title">Dettagli Manutenzione</h3>
                  <p class="modal-sub">Seleziona il periodo e la motivazione del blocco.</p>

                  <div class="row g-3 mb-4 mt-1">
                    <div class="col-6 field-wrap mb-0">
                      <label class="field-label">Inizio Blocco</label>
                      <input type="datetime-local" v-model="manutenzioneData.inizio" class="form-input w-100">
                    </div>
                    <div class="col-6 field-wrap mb-0">
                      <label class="field-label">Fine Blocco</label>
                      <input type="datetime-local" v-model="manutenzioneData.fine" class="form-input w-100"
                        :class="{ 'border-danger': manutenzioneData.fine && !isManutenzioneValida }">
                    </div>
                  </div>

                  <div class="form-group mb-4">
                    <label class="field-label">Motivazione (Opzionale)</label>
                    <textarea v-model="manutenzioneData.motivazione" class="form-input w-100" style="height:auto; min-height:80px;" rows="2" placeholder="Es. Lavori di verniciatura o riparazione prese"></textarea>
                  </div>
                </div>
                
                <div class="review-footer d-flex gap-2">
                  <button class="cta-btn cta-btn--ghost flex-grow-1" @click="showMaintenanceModal = false">Annulla</button>
                  <button class="cta-btn cta-btn--danger flex-grow-1" :disabled="!isManutenzioneValida" @click="salvaManutenzione">Conferma Blocco</button>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>

  <Footer />
  </div>
</template>

<style scoped>

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
  overflow-y: auto; /* Aggiunto da style/ui-cleanup */
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

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.35s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active {
  transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
}

.modal-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.modal-slide-enter-from {
  transform: translateY(40px) scale(0.96);
  opacity: 0;
}

.modal-slide-leave-to {
  transform: translateY(20px) scale(0.97);
  opacity: 0;
}

.review-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 23, 0.55);
  backdrop-filter: blur(5px) saturate(130%);
  -webkit-backdrop-filter: blur(5px) saturate(130%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10500;
  padding: 1.25rem;
}

.review-modal {
  background: #ffffff;
  width: 100%;
  max-width: 480px;
  border-radius: 28px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.06);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.review-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.9rem 1.5rem 0;
  flex-shrink: 0;
}

.review-body {
  padding: 1rem 1.75rem 1rem;
  overflow-y: auto;
  flex: 1;
}

.review-footer {
  padding: 1rem 1.75rem 1.5rem;
  background: #ffffff;
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.cta-btn--primary {
  background: var(--primary-blue, #00408A);
}

.cta-btn--primary:hover:not(:disabled) {
  background: #00336E;
  box-shadow: 0 8px 24px rgba(0, 64, 138, 0.25);
}

.review-body::-webkit-scrollbar {
  width: 6px;
}

.review-body::-webkit-scrollbar-track {
  background: transparent;
}

.review-body::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}

.garage-chip {
  display: inline-block;
  background: rgba(0, 64, 138, 0.08);
  color: var(--primary-blue, #00408A);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 5px 13px;
  border-radius: 99px;
  margin-bottom: 1rem;
}

.modal-title {
  font-size: 1.45rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.35rem;
}

.modal-sub {
  font-size: 0.88rem;
  color: #64748b;
  margin-bottom: 1.1rem;
  line-height: 1.4;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #94a3b8;
}

.optional-pill {
  background: #f1f5f9;
  color: #94a3b8;
  font-size: 0.68rem;
  padding: 2px 9px;
  border-radius: 99px;
  text-transform: lowercase;
  font-weight: 600;
}

.review-textarea {
  width: 100%;
  background: #f8fafc;
  border: 1.5px solid #e8edf3;
  border-radius: 14px;
  padding: 13px 15px;
  font-size: 0.88rem;
  color: #334155;
  resize: none;
  outline: none;
}

.cta-btn {
  padding: 14px 24px;
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.cta-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.cta-btn--ghost {
  background: transparent;
  color: #00408A;
  border: 1.5px solid rgba(0, 64, 138, 0.18);
}

.cta-btn--danger {
  background: #dc3545;
}

.cta-btn--danger:hover:not(:disabled) {
  background: #c82333;
  box-shadow: 0 8px 24px rgba(220, 53, 69, 0.3);
}

.max-h-150 {
  max-height: 150px;
}

.back-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #0f172a;
}

.step-track {
  display: flex;
  gap: 6px;
}

.step-pip {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: #e2e8f0;
  transition: width 0.35s ease, background 0.35s ease;
}

.step-pip--on {
  width: 20px;
  background: #00408A;
}

.extra-small {
  font-size: 0.75rem;
}

.max-h-300 {
  max-height: 300px;
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(10px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.step-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>