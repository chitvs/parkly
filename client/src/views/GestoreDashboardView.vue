<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { authStore } from '../store/auth.js'
import { walletStore } from '../store/wallet.js'
import { garageStore } from '../store/garage.js'
import { alertStore } from '../store/alert.js'
import { prenotazioniStore } from '../store/prenotazioni.js'
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

const vistaAttiva = ref('garage')
const isLoading = ref(false)
const staSalvando = ref(false)
const reRenderKey = ref(0)
const isGarageDropdownOpen = ref(false)
const isSidebarOpen = ref(false) // variabile per il menu mobile

// Collegamenti ai dati dello Store
const mieiGarage = computed(() => garageStore.mieiGarage || [])
const postiPerGarage = computed(() => garageStore.postiPerGarage || {})
const occupazioneGarage = computed(() => garageStore.occupazioneGarage || {})
const allerteStato = computed(() => garageStore.allerteStato || [])
const storicoPrenotazioni = ref([])

const idGarageSelezionatoGlobale = computed({
  get: () => garageStore.idGarageSelezionato,
  set: (val) => garageStore.setGarageSelezionato(val)
})

const mieiGarageFiltrati = computed(() => {
  if (idGarageSelezionatoGlobale.value === 'TUTTI') {
    return mieiGarage.value;
  }
  return mieiGarage.value.filter(g => Number(g.id_garage) === Number(idGarageSelezionatoGlobale.value));
})

const storicoPrenotazioniFiltrato = computed(() => {
  if (idGarageSelezionatoGlobale.value === 'TUTTI') {
    return storicoPrenotazioni.value;
  }
  return storicoPrenotazioni.value.filter(p => Number(p.id_garage) === Number(idGarageSelezionatoGlobale.value));
})

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
  alertStore.pulisci()
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

// Logica Two-Step (Store Database + Foto Store Supabase)
const salvaNuovoGarage = async (payload) => {
  alertStore.pulisci()
  staSalvando.value = true

  try {
    // STEP 1: Creazione/Modifica Testo Garage tramite Store
    const res = isEditing.value
      ? await garageStore.updateGarage(idGarageInModifica.value, payload)
      : await garageStore.createGarage(payload)

    if (res.success || res.garage) {
      // Otteniamo il nuovo ID in base a come lo store restituisce l'oggetto
      const nuovoIdGarage = isEditing.value ? idGarageInModifica.value : (res.garage?.id_garage || res.data?.id_garage)

      // STEP 2: Caricamento Immagini tramite la chiamata allo store
      if (fotoDaCaricare.value.length > 0 && nuovoIdGarage) {
        const formData = new FormData()
        fotoDaCaricare.value.forEach(file => formData.append('foto_garage', file))

        const resFoto = await garageStore.uploadPhotos(nuovoIdGarage, formData)

        if (!resFoto.success) {
          console.error("Errore durante l'upload delle foto su Supabase: ", resFoto.error)
        }
      }

      // Pulizia form
      isEditing.value = false
      idGarageInModifica.value = null
      garageInModifica.value = null
      fotoDaCaricare.value = []

      // Refresh dei dati tramite store
      await garageStore.caricaDashboardGestore()
      alertStore.mostra('success', isEditing.value ? 'Garage aggiornato!' : 'Garage pubblicato!')
      vistaAttiva.value = 'garage'
    } else {
      alertStore.mostra('error', res.error || 'Errore durante il salvataggio')
    }
  } catch (e) {
    console.error(e)
    alertStore.mostra('error', 'Errore di rete o del server.')
  } finally {
    staSalvando.value = false
  }
}

const showConfirmDisableModal = ref(false);
const garageDaDisattivare = ref(null);

const cambiaStatoGarage = async (garage) => {
  const nuovoStato = !garage.isattivo;

  if (nuovoStato === false) {
    // Invece del confirm, apriamo il modal
    garageDaDisattivare.value = garage;
    showConfirmDisableModal.value = true;
    return;
  }

  // Se è un'attivazione, procediamo direttamente
  await eseguiCambioStato(garage, true);
};

const eseguiCambioStato = async (garage, stato) => {
  alertStore.pulisci();
  try {
    const res = await garageStore.updateGarage(garage.id_garage, { isattivo: stato });

    if (res.success || res.garage) {
      alertStore.mostra('success', `Garage ${stato ? 'attivato' : 'disattivato e rimborsi erogati'} con successo!`);
      await garageStore.caricaDashboardGestore();
    } else {
      alertStore.mostra('error', res.error || 'Errore durante il cambio di stato.');
      await garageStore.caricaDashboardGestore();
    }
  } catch (e) {
    console.error(e);
    alertStore.mostra('error', 'Errore di rete.');
    await garageStore.caricaDashboardGestore();
  }
};

// --- Funzioni per gestire le azioni del Modal ---
const confermaDisattivazione = async () => {
  if (garageDaDisattivare.value) {
    await eseguiCambioStato(garageDaDisattivare.value, false);
  }
  chiudiModalDisattivazione();
};

const chiudiModalDisattivazione = () => {
  showConfirmDisableModal.value = false;
  garageDaDisattivare.value = null;
};

const aggiornaMappaOrari = async ({ inizio, fine }) => {
  const iIso = new Date(inizio).toISOString()
  const fIso = new Date(fine).toISOString()
  await garageStore.aggiornaMappaOrariGestore(iIso, fIso)
}

const infoModalElement = ref(null)
let infoModalInstance = null
const openInfoModal = () => { if (infoModalInstance) infoModalInstance.show() }

const showMaintenanceModal = ref(false)
const maintenanceError = ref('')
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
  maintenanceError.value = ''
  const res = await garageStore.addMaintenance(postoDaGestire.value.id_garage, postoDaGestire.value.id_posto, manutenzioneData.value)
  if (res.success) {
    showMaintenanceModal.value = false
    alertStore.mostra('success', res.message)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    await garageStore.caricaDashboardGestore()
  } else {
    maintenanceError.value = res.error
  }
}

const rimuoviManutenzione = async () => {
  maintenanceError.value = ''
  const idManutenzione = postoDaGestire.value?.manutenzione?.id_manutenzione;
  if (!idManutenzione) return;

  const res = await garageStore.removeMaintenance(postoDaGestire.value.id_garage, postoDaGestire.value.id_posto, idManutenzione);

  if (res.success) {
    showMaintenanceModal.value = false;
    alertStore.mostra('success', res.message)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    await garageStore.caricaDashboardGestore()
  } else {
    maintenanceError.value = res.error;
  }
};

onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([
      walletStore.contabilizzaRicavi(),
      walletStore.caricaSaldoSospeso(),
      garageStore.caricaDashboardGestore(),
    ])
    const res = await prenotazioniStore.getPrenotazioniGestore()
    if (res && res.data) {
      storicoPrenotazioni.value = Array.isArray(res.data) ? res.data : (res.data.prenotazioni || [])
    } else if (res) {
      storicoPrenotazioni.value = res.prenotazioni || res
    }
    if (mieiGarage.value.length === 0) vistaAttiva.value = 'aggiungi'
    else vistaAttiva.value = 'garage'
  } finally {
    isLoading.value = false
  }

  if (infoModalElement.value) {
    infoModalInstance = new bootstrap.Modal(infoModalElement.value)
  }
  socket = getSocket()
  if (socket) socket.on('nuovo_messaggio', handleNuovoMessaggio)
})

onUnmounted(() => {
  if (infoModalInstance) infoModalInstance.dispose()
  if (socket) socket.off('nuovo_messaggio', handleNuovoMessaggio)
})

watch(vistaAttiva, (newVal) => {
  alertStore.pulisci() // Pulisce gli alert globali cambiando vista
  isSidebarOpen.value = false // chiude il menu mobile al cambio di vista
  if (newVal !== 'aggiungi') {
    idGarageInModifica.value = null
    garageInModifica.value = null
    isEditing.value = false
  }
})

const navTop = [
  { id: 'garage', label: 'I miei Garage', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
  { id: 'aggiungi', label: 'Aggiungi Garage', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
]

const navBottom = [
  { id: 'statistiche', label: 'Statistiche', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>' },
  { id: 'stato', label: 'Stato Corrente', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { id: 'storico', label: 'Storico Prenotazioni', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
]

const showNavBottom = computed(() => mieiGarage.value.length > 0)

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
      <!-- Overlay menu mobile -->
      <div class="sidebar-overlay" :class="{ 'd-block': isSidebarOpen }" @click="isSidebarOpen = false"></div>

      <!-- Barra mobile con hamburger -->
      <div class="mobile-topbar d-md-none">
        <button class="hamburger-btn" @click="isSidebarOpen = true">
          <i class="bi bi-list fs-3"></i>
        </button>
        <span class="mobile-topbar-title">Area Gestore</span>
      </div>

      <aside :class="['sidebar', { 'sidebar-open': isSidebarOpen }]">
        <div class="sidebar-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
          <span>Area Gestore</span>
          <button class="close-sidebar-btn d-md-none" @click="isSidebarOpen = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <nav class="sidebar-nav top-nav">
          <a v-for="item in navTop" :key="item.id" href="#" v-show="showNavBottom || item.id === 'aggiungi'"
            :class="['nav-item', { active: vistaAttiva === item.id }]" @click.prevent="vistaAttiva = item.id">
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="vistaAttiva === item.id" class="nav-indicator"></span>
          </a>
        </nav>

        <div class="sidebar-divider" v-if="showNavBottom"></div>

        <div class="sidebar-filter" v-if="showNavBottom">
          <span class="sidebar-filter-label">Garage</span>

          <div class="garage-dropdown-wrapper">
            <button class="garage-trigger" @click="isGarageDropdownOpen = !isGarageDropdownOpen">
              <span>{{idGarageSelezionatoGlobale === 'TUTTI' ? 'Tutti i Garage' : mieiGarage.find(g => g.id_garage ===
                idGarageSelezionatoGlobale)?.nome}}</span>
              <svg :class="['garage-chevron', { 'rotated': isGarageDropdownOpen }]" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <ul v-if="isGarageDropdownOpen" class="garage-menu">
              <li v-if="idGarageSelezionatoGlobale !== 'TUTTI'">
                <a class="garage-menu-item" @click="idGarageSelezionatoGlobale = 'TUTTI'; isGarageDropdownOpen = false">
                  Tutti i Garage
                </a>
              </li>
              <li v-for="g in mieiGarage" :key="g.id_garage" v-show="idGarageSelezionatoGlobale !== g.id_garage">
                <a class="garage-menu-item"
                  @click="idGarageSelezionatoGlobale = g.id_garage; isGarageDropdownOpen = false">
                  {{ g.nome }}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <nav class="sidebar-nav bottom-nav" v-if="showNavBottom">
          <a v-for="item in navBottom" :key="item.id" href="#"
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
          <DashboardStats v-if="vistaAttiva === 'statistiche'" :miei-garage="mieiGarageFiltrati"
            :storico-prenotazioni="storicoPrenotazioniFiltrato" />

          <DashboardGarageList v-if="vistaAttiva === 'garage'" :miei-garage="mieiGarage" @modifica="preparaModifica"
            @toggle-stato="cambiaStatoGarage" />

          <DashboardStato v-if="vistaAttiva === 'stato'" :key="'stato-' + reRenderKey" :miei-garage="mieiGarageFiltrati"
            :posti-per-garage="postiPerGarage" :occupazione-garage="occupazioneGarage" :allerte-stato="allerteStato"
            @verifica-disponibilita="aggiornaMappaOrari" @manage-posto="apriGestionePosto" />

          <DashboardStorico v-if="vistaAttiva === 'storico'" :prenotazioni="storicoPrenotazioniFiltrato"
            @apri-chat="apriChat" />

          <DashboardGarageForm v-if="vistaAttiva === 'aggiungi'" :is-editing="isEditing" :garage-data="garageInModifica"
            :sta-salvando="staSalvando" @save="salvaNuovoGarage" @update-photos="handleFotoDalComponente"
            @open-info="openInfoModal" />
        </template>
      </main>
    </div>

    <div class="modal fade" id="infoModal" ref="infoModalElement" tabindex="-1" aria-labelledby="infoModalLabel"
      aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content parkly-modal">
          <div class="modal-header border-0">
            <h5 class="modal-title modal-title-text" id="infoModalLabel">
              <i class="bi bi-info-circle me-2"></i> Guida alla pubblicazione
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-4 pb-4 pt-0">
            <ul class="info-list">
              <li>Cerca il tuo indirizzo per avvicinarti, poi clicca sulla mappa interattiva per posizionare il pin
                esattamente sopra il tuo garage.</li>
              <li>Configura la tipologia del posto (Auto, Moto, Furgone) e aggiungi servizi extra. Il codice verrà
                generato in automatico se lasciato vuoto.</li>
              <li>Una volta creati i posti, selezionali dalla tavolozza e clicca sulla griglia a scacchiera per
                disegnare visivamente il layout reale del garage.</li>
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

            <div v-if="maintenanceError" class="alert error mx-4 mt-3 mb-0 text-start">
              {{ maintenanceError }}
            </div>

            <div v-if="postoDaGestire?.is_in_manutenzione" class="step-wrapper fade-in">
              <div class="review-body pt-2">
                <span class="garage-chip">Posto {{ postoDaGestire?.codiceposto }}</span>
                <h3 class="modal-title">Manutenzione in corso</h3>
                <p class="modal-sub">Questo posto è bloccato e non è visibile ai clienti.</p>

                <div class="p-3 bg-light border rounded-3 mb-4">
                  <strong class="d-block mb-2 text-dark" style="font-size: 0.85rem; text-transform: uppercase;">Dettagli
                    del blocco:</strong>
                  <div class="d-flex justify-content-between mb-1 small">
                    <span class="text-muted">Inizio:</span>
                    <span class="fw-bold">{{ formattaDataLeggibile(postoDaGestire.manutenzione?.inizio) }}</span>
                  </div>
                  <div class="d-flex justify-content-between mb-2 small">
                    <span class="text-muted">Fine:</span>
                    <span class="fw-bold text-danger">{{ formattaDataLeggibile(postoDaGestire.manutenzione?.fine)
                    }}</span>
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
                    <div v-if="prenotazioniPostoSelezionato.length === 0"
                      class="p-4 bg-light rounded-4 text-center border">
                      <i class="bi bi-calendar-check text-success fs-2 d-block mb-2"></i>
                      <span class="text-muted small">Nessun impegno futuro per questo posto.<br>Puoi procedere
                        liberamente.</span>
                    </div>
                    <div v-else class="d-flex flex-column gap-2 pe-1">
                      <div v-for="pren in prenotazioniPostoSelezionato" :key="pren.id_prenotazione"
                        class="p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center">
                        <div>
                          <span class="fw-bold d-block text-dark small">{{ pren.targa || 'Targa N/D' }}</span>
                          <span class="text-muted extra-small">{{ formattaDataLeggibile(pren.iniziososta) }} - {{
                            formattaDataLeggibile(pren.finesosta) }}</span>
                        </div>
                        <span
                          class="badge bg-primary-subtle text-primary rounded-pill px-2 py-1 extra-small">Prenotato</span>
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
                    <textarea v-model="manutenzioneData.motivazione" class="form-input w-100"
                      style="height:auto; min-height:80px;" rows="2"
                      placeholder="Es. Lavori di verniciatura o riparazione prese"></textarea>
                  </div>
                </div>

                <div class="review-footer d-flex gap-2">
                  <button class="cta-btn cta-btn--ghost flex-grow-1"
                    @click="showMaintenanceModal = false">Annulla</button>
                  <button class="cta-btn cta-btn--danger flex-grow-1" :disabled="!isManutenzioneValida"
                    @click="salvaManutenzione">Conferma Blocco</button>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
    <Transition name="overlay-fade">
      <div v-if="showConfirmDisableModal" class="review-overlay" @click.self="chiudiModalDisattivazione">
        <Transition name="modal-slide" appear>
          <div class="review-modal">

            <div class="review-topbar">
              <div class="step-track">
                <span class="step-pip step-pip--on" style="background: #dc3545; width: 20px;"></span>
              </div>
              <button class="close-btn" @click="chiudiModalDisattivazione">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>

            <div class="review-body pt-2 text-center">
              <div class="mb-3">
                <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 3rem;"></i>
              </div>

              <span class="garage-chip" style="background: rgba(220, 53, 69, 0.1); color: #dc3545;">
                Azione Irreversibile
              </span>

              <h3 class="modal-title" style="color: #c82333;">Sei sicuro?</h3>

              <p class="modal-sub">
                Stai per disattivare il garage <strong>{{ garageDaDisattivare?.nome }}</strong>.
              </p>

              <div class="alert error p-3 rounded-4 mb-4 text-start"
                style="font-size: 0.85rem; border: none; background: #FFF5F5; color: #B91C1C;">
                <ul class="mb-0 ps-3">
                  <li>Le prenotazioni future verranno <strong>annullate</strong>.</li>
                  <li>Verranno emessi <strong>rimborsi automatici</strong> al 100%.</li>
                  <li>Il garage non sarà più visibile ai nuovi clienti.</li>
                </ul>
              </div>
            </div>

            <div class="review-footer d-flex gap-2">
              <button class="cta-btn cta-btn--ghost flex-grow-1" @click="chiudiModalDisattivazione">
                Annulla
              </button>
              <button class="cta-btn cta-btn--danger flex-grow-1" @click="confermaDisattivazione">
                Disattiva Ora
              </button>
            </div>

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

/* Stili Mobile Header */
.mobile-topbar {
  display: none;
  align-items: center;
  gap: 16px;
  background-color: var(--deep-blue, #00204A);
  color: white;
  padding: 12px 20px;
}

.hamburger-btn {
  background: none;
  border: none;
  color: white;
  padding: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.mobile-topbar-title {
  font-weight: 600;
  font-size: 1.1rem;
}

.close-sidebar-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  margin-left: auto;
  font-size: 1.2rem;
  padding: 4px;
  cursor: pointer;
}

.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1040;
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

.sidebar-nav.top-nav {
  flex: 0 0 auto;
}

.sidebar-nav.bottom-nav {
  flex: 1;
}

.sidebar-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 16px 8px;
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

.sidebar-filter {
  padding: 0 12px 14px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.07);
  margin-bottom: 4px;
}

.sidebar-filter-label {
  display: block;
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 5px;
  padding-left: 2px;
}

.garage-dropdown-wrapper {
  position: relative;
}

.garage-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.92);
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 7px 11px;
  font-size: 0.82rem;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  font-weight: 400;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  text-align: left;
}

.garage-trigger:hover {
  background-color: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.20);
}

.garage-chevron {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s ease;
}

.garage-chevron.rotated {
  transform: rotate(180deg);
}

.garage-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #F4F7F6;
  border-radius: 14px;
  padding: 0.45rem 1rem;
  list-style: none;
  margin: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 200;
  overflow: hidden;
}

.garage-menu-item {
  display: block;
  padding: 0.25rem 0;
  font-size: 0.88rem;
  color: #00408A;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  cursor: pointer;
  transition: background-color 0.12s ease;
  text-decoration: none;
}

.garage-menu-item:hover {
  background-color: #e8eef8;
  color: #00408A;
}

/* MEDIA QUERIES PER MOBILE / TABLET */
@media (max-width: 768px) {
  .dashboard-layout {
    flex-direction: column;
  }

  .mobile-topbar {
    display: flex;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: -280px;
    /* Nasconde la sidebar */
    width: 280px;
    height: 100vh;
    z-index: 1050;
    transition: left 0.3s ease-in-out;
    padding-top: 16px;
  }

  .sidebar.sidebar-open {
    left: 0;
    /* Mostra la sidebar */
  }

  .main-content {
    padding: 20px 16px;
  }
}
</style>