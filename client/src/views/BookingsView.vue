<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed, reactive } from 'vue'
import { prenotazioniStore } from '../store/prenotazioni.js'
import { useRecensione } from '../composables/useRecensione.js'
import { getSocket } from '../composables/useChat.js'

import 'bootstrap-icons/font/bootstrap-icons.css'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import ChatBox from '../components/ChatBox.vue'
import Pagination from '../components/Pagination.vue'

// Icone dei bottoni annulla e contatta
import IconCancel from '../icons/IconCancel.vue'
import IconMessage from '../icons/IconMessage.vue'

// variabili per i filtri e l'ordinamento
const filtroStato = ref('') // '' = Tutte, 'ATTIVA', 'CONCLUSA', 'ANNULLATA'
const filtroGarage = ref('') // '' = Tutti, oppure l'id_garage
const ordinamento = ref('creazione_desc') // default: data creazione più recente
const pageMessage = ref(null)

// variabili per la paginazione
const paginaCorrente = ref(1)
const elementiPerPagina = ref(5)


// Stati reattivi per i dati del componente
const bookings = ref([]) // Conterrà l'array delle prenotazioni dell'utente
const isLoading = ref(true) // Gestisce l'UI di caricamento

// Import delle funzioni e stati esportati dal composable delle recensioni
const {
  showReviewModal,
  currentStep,
  selectedBookingForReview,
  recensioneForm,
  isStep2Complete,
  isEditing,
  iniziaRecensione,
  apriModifica,
  chiudiModale,
  inviaRecensione,
  eliminaRecensione,
  reviewError
} = useRecensione()

// Stato per gestire la chat aperta 
const chatSelezionata = ref(null)

// Variabile per tenere traccia del socket in questa pagina
let socket = null;

// --- GESTIONE NOTIFICHE IN TEMPO REALE ---
// Funzione chiamata ogni volta che il server emette un evento 'nuovo_messaggio'
const handleNuovoMessaggio = (msg) => {
  // Cerca la prenotazione di riferimento nell'elenco
  const bookingToUpdate = bookings.value.find(b => Number(b.id_prenotazione) === Number(msg.id_prenotazione));

  if (bookingToUpdate) {
    // Controlla se l'utente ha già la chat aperta per quella specifica prenotazione
    const chatAperta = chatSelezionata.value && chatSelezionata.value.idPrenotazione === Number(msg.id_prenotazione);
    // Se la chat non è aperta, incrementa il counter dei messaggi non letti per far apparire il pallino rosso
    if (!chatAperta) {
      bookingToUpdate.nonletti = (bookingToUpdate.nonletti || 0) + 1;
    }
  }
}


onMounted(async () => {
  // Carica i dati appena il componente viene montato
  await caricaPrenotazioni()

  // Inizializza il WebSocket e metti in ascolto gli eventi globali di notifica
  socket = getSocket();
  socket.on('nuovo_messaggio', handleNuovoMessaggio);
})

// Pulizia fondamentale per evitare memory leak e doppi listener se l'utente naviga tra le pagine
onUnmounted(() => {
  if (socket) {
    socket.off('nuovo_messaggio', handleNuovoMessaggio);
  }
})

// Chiamata all'API per prendere le prenotazioni
const caricaPrenotazioni = async () => {
  isLoading.value = true
  const response = await prenotazioniStore.getBookings()
  if (response.success) {
    bookings.value = response.data
  } else {
    pageMessage.value = { tipo: 'error', testo: response.error || "Impossibile caricare le prenotazioni" }
  }
  isLoading.value = false
}

// estrae la lista dei garage in cui l'utente ha prenotato almeno una volta
const garageDisponibili = computed(() => {
  const map = new Map()
  bookings.value.forEach(b => {
    if (!map.has(b.id_garage)) {
      map.set(b.id_garage, b.nomegarage)
    }
  })
  return Array.from(map, ([id, nome]) => ({ id, nome }))
})

// applica i filtri e l'ordinamento scelti
const prenotazioniFiltrate = computed(() => {
  // filtriamo
  let risultato = bookings.value.filter(b => {
    const matchStato = filtroStato.value === '' || b.stato === filtroStato.value
    const matchGarage = filtroGarage.value === '' || String(b.id_garage) === String(filtroGarage.value)
    return matchStato && matchGarage
  })

  // ordiniamo
  risultato.sort((a, b) => {
    const dataA_creazione = new Date(a.datacreazione).getTime()
    const dataB_creazione = new Date(b.datacreazione).getTime()
    const dataA_inizio = new Date(a.iniziososta).getTime()
    const dataB_inizio = new Date(b.iniziososta).getTime()

    switch (ordinamento.value) {
      case 'creazione_desc':
        return dataB_creazione - dataA_creazione // più recenti prima
      case 'creazione_asc':
        return dataA_creazione - dataB_creazione // più vecchie prima
      case 'cronologico_desc':
        return dataB_inizio - dataA_inizio // soste più lontane nel tempo prima
      case 'cronologico_asc':
        return dataA_inizio - dataB_inizio // soste più imminenti prima
      default:
        return 0
    }
  })

  return risultato
})

// logica di Paginazione calcolata sull'array filtrato
const prenotazioniPaginate = computed(() => {
  const inizio = (paginaCorrente.value - 1) * elementiPerPagina.value
  return prenotazioniFiltrate.value.slice(inizio, inizio + elementiPerPagina.value)
})

const scrollInAlto = () => window.scrollTo({ top: 0, behavior: 'smooth' })

// resetta la pagina a 1 ogni volta che cambia un filtro o l'ordinamento
watch([filtroStato, filtroGarage, ordinamento], () => {
  paginaCorrente.value = 1
})

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome'
  }).format(date)
}

const getStatusBadgeClass = (stato) => {
  switch (stato) {
    case 'ATTIVA': return 'bg-success'
    case 'CONCLUSA': return 'bg-secondary'
    case 'ANNULLATA': return 'bg-danger'
    default: return 'bg-primary'
  }
}

// Variabili per il modale di annullamento
const showCancelModal = ref(false)
const bookingToCancel = ref(null)
const infoAnnullamento = reactive({
  rimborso: 0,
  messaggio: '',
  motivazione: '',
  classe: ''
})

// Funzione per calcolare il rimborso "al volo" per la UI
const calcolaAnteprimaAnnullamento = (booking) => {
  const oraAttuale = new Date()
  const inizioSosta = new Date(booking.iniziososta)
  const dataCreazione = new Date(booking.datacreazione)

  const oreAllInizio = (inizioSosta - oraAttuale) / (1000 * 60 * 60)
  const minutiDallaCreazione = (oraAttuale - dataCreazione) / (1000 * 60)
  const prezzo = parseFloat(booking.prezzototale)

  if (oreAllInizio > 12 || minutiDallaCreazione <= 15) {
    infoAnnullamento.percentuale = 100
    infoAnnullamento.rimborso = prezzo
    infoAnnullamento.messaggio = 'Cancellazione Gratuita! Riceverai un rimborso completo.'
    infoAnnullamento.classe = 'text-success'
  } else if (oreAllInizio > 0) {
    infoAnnullamento.percentuale = 50
    infoAnnullamento.rimborso = prezzo * 0.5
    infoAnnullamento.messaggio = 'Annullamento tardivo: riceverai un rimborso del 50%.'
    infoAnnullamento.classe = 'text-warning'
  } else {
    infoAnnullamento.percentuale = 0
    infoAnnullamento.rimborso = 0
    infoAnnullamento.messaggio = 'Sosta già iniziata: non è previsto alcun rimborso.'
    infoAnnullamento.classe = 'text-danger'
  }
}

const apriModaleAnnullamento = async (booking) => {
  bookingToCancel.value = booking
  // Chiamata all'API di anteprima che abbiamo appena aggiornato
  const res = await prenotazioniStore.getAnteprimaAnnullamento(booking.codiceprenotazione)
  if (res.success) {
    Object.assign(infoAnnullamento, res.dati)
    showCancelModal.value = true
  }
}

// Gestione della cancellazione di una prenotazione
const handleConfirmCancel = async () => {
  if (!bookingToCancel.value) return

  const response = await prenotazioniStore.cancelBooking(bookingToCancel.value.codiceprenotazione)

  if (response.success) {
    bookingToCancel.value.stato = 'ANNULLATA'
    showCancelModal.value = false
    pageMessage.value = { tipo: 'success', testo: `Prenotazione annullata. Rimborsati: €${infoAnnullamento.rimborso.toFixed(2)}` }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    pageMessage.value = { tipo: 'error', testo: response.error || "Errore durante l'annullamento" }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const chiudiEAggiorna = async () => {
  chiudiModale()
  await caricaPrenotazioni()
}

const handleElimina = async () => {
  const success = await eliminaRecensione()
  if (success) {
    await caricaPrenotazioni()
  }
}

watch(showReviewModal, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

const categories = [
  { id: 'posizione', label: 'Posizione', icon: 'bi bi-geo-alt' },
  { id: 'qualitaPrezzo', label: 'Prezzo', icon: 'bi bi-tag' },
  { id: 'pulizia', label: 'Pulizia', icon: 'bi bi-stars' },
  { id: 'spazio', label: 'Spazio di manovra', icon: 'bi bi-car-front' },
  { id: 'sicurezza', label: 'Sicurezza', icon: 'bi bi-shield-check' },
]

// Gestione dell'apertura del componente ChatBox
const apriChat = async (booking) => {
  // Rimuove il pallino rosso (notifica letta)
  booking.nonletti = 0;

  // Tecnica per forzare il re-mount del componente figlio (ChatBox):
  // Impostandolo a null lo rimuoviamo dal DOM
  chatSelezionata.value = null;

  // Aspetta un "tick" del ciclo di rendering di Vue per assicurarsi che il DOM sia aggiornato
  await nextTick();

  // Reimposta l'oggetto ricreando il componente ChatBox fresco
  chatSelezionata.value = {
    idPrenotazione: Number(booking.id_prenotazione),
    idDestinatario: Number(booking.id_gestore),
    nomeDestinatario: booking.nomegestore || booking.nomegarage || 'Gestore'
  }
}

const chiudiChat = () => {
  chatSelezionata.value = null
}
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <main class="container py-5 flex-grow-1">
      <div v-if="pageMessage" :class="['alert', pageMessage.tipo, 'mb-4']">
        {{ pageMessage.testo }}
      </div>

      <div class="row mb-4">
        <div class="col-12 text-center text-md-start">
          <h2 class="fw-bold title-color">Le Tue Prenotazioni</h2>
          <p class="text-muted">Storico dei tuoi parcheggi su Parkly</p>
        </div>
      </div>

      <div class="row mb-4 g-3 align-items-center bg-white p-3 rounded-3 shadow-sm border" v-if="bookings.length > 0">
        <div class="col-12 col-md-4">
          <label class="form-label text-muted small fw-bold text-uppercase mb-1">Stato Prenotazione</label>
          <select class="form-select" v-model="filtroStato">
            <option value="">Tutte</option>
            <option value="ATTIVA">Attive</option>
            <option value="CONCLUSA">Concluse</option>
            <option value="ANNULLATA">Annullate</option>
          </select>
        </div>

        <div class="col-12 col-md-4">
          <label class="form-label text-muted small fw-bold text-uppercase mb-1">Filtra per Garage</label>
          <select class="form-select" v-model="filtroGarage">
            <option value="">Tutti i garage</option>
            <option v-for="g in garageDisponibili" :key="g.id" :value="g.id">{{ g.nome }}</option>
          </select>
        </div>

        <div class="col-12 col-md-4">
          <label class="form-label text-muted small fw-bold text-uppercase mb-1">Ordina per</label>
          <select class="form-select" v-model="ordinamento">
            <option value="creazione_desc">Data Creazione (Più recenti)</option>
            <option value="creazione_asc">Data Creazione (Meno recenti)</option>
            <option value="cronologico_asc">Arrivo (Imminenti)</option>
            <option value="cronologico_desc">Arrivo (Più lontani)</option>
          </select>
        </div>
      </div>

      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Caricamento...</span>
        </div>
      </div>

      <div v-else-if="bookings.length === 0" class="text-center py-5 empty-state">
        <img src="../assets/broken_car.png" alt="Nessuna prenotazione" width="120" class="mb-3 opacity-50" />
        <h4 class="fw-bold text-muted">Nessuna prenotazione trovata</h4>
        <p class="text-muted">Non hai ancora effettuato nessuna prenotazione su Parkly.</p>
        <router-link to="/ricerca" class="btn btn-primary mt-3 px-4 py-2">Trova Parcheggio</router-link>
      </div>

      <div v-else-if="prenotazioniFiltrate.length === 0" class="text-center py-5 empty-state">
        <h5 class="fw-bold text-muted">Nessun risultato</h5>
        <p class="text-muted">Nessuna prenotazione corrisponde ai filtri selezionati.</p>
        <button class="btn btn-outline-primary mt-2"
          @click="filtroStato = ''; filtroGarage = ''; ordinamento = 'creazione_desc'">Resetta Filtri</button>
      </div>

      <div v-else class="row g-4">
        <div class="col-12" v-for="(booking, index) in prenotazioniPaginate" :key="index">
          <div class="card booking-card border-0 shadow-sm">
            <div class="card-body p-4">

              <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                <div>
                  <router-link :to="`/garage/${booking.id_garage}`" class="text-decoration-none">
                    <h5 class="fw-bold mb-0 text-dark garage-title-link">{{ booking.nomegarage }}</h5>
                  </router-link>
                  <small class="text-muted"><i class="bi bi-geo-alt-fill me-1"></i>{{ booking.indirizzo }}</small>
                </div>
                <div class="action-group d-flex align-items-center gap-2">

                  <!-- Badge Stato  -->
                  <span class="custom-badge" :class="'badge-' + booking.stato.toLowerCase()">
                    {{ booking.stato }}
                  </span>

                  <!-- Pulsante Annulla  -->
                  <button 
                      v-if="booking.stato === 'ATTIVA'" 
                      @click="handleCancelBooking(booking.codiceprenotazione)" 
                      class="custom-btn btn-cancel"
                      title="Annulla Prenotazione"
                  >
                  <IconCancel width="18" height="18" />
                  Annulla
                  </button>

                  <!-- Pulsante Chat -->
                  <button 
                    v-if="booking.stato === 'ATTIVA'" 
                    @click="apriChat(booking)" 
                    class="custom-btn btn-chat"
                    title="Contatta il gestore"
                  >
                    <!-- Pallino notifica-->
                    <span v-if="booking.nonletti > 0" class="chat-notification-dot"></span>
                      <IconMessage width="18" height="18" />
                        Contatta
                  </button>

                  <!-- Pulsante Recensioni-->
                  <div v-if="booking.stato === 'CONCLUSA' && !booking.ha_recensito"
                    class="d-flex align-items-center ms-3 border-start ps-3">
                    <span class="text-muted small fw-semibold me-2 d-none d-sm-inline">Com'è andata?</span>
                    <div class="d-flex gap-1 trigger-stars">
                      <i v-for="star in 5" :key="star" class="bi bi-star text-warning cursor-pointer fs-5"
                        @click="iniziaRecensione(booking, star)"></i>
                    </div>
                  </div>

                  <div v-else-if="booking.stato === 'CONCLUSA' && booking.ha_recensito"
                    class="d-flex align-items-center gap-2 ms-3 border-start ps-3">
                    <span class="text-success d-flex align-items-center me-1">
                      <i class="bi bi-check-circle-fill me-1 fs-5"></i>
                      <span class="small fw-bold text-uppercase d-none d-sm-inline">Recensita</span>
                    </span>
                    <button class="btn-edit-icon" title="Modifica Recensione" @click="apriModifica(booking)">
                      <i class="bi bi-pencil"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="row align-items-center">
                <div class="col-md-3 mb-3 mb-md-0">
                  <span class="d-block text-muted small fw-semibold text-uppercase mb-1">Cod. Prenotazione</span>
                  <span class="fw-bold fs-5 text-primary">{{ booking.codiceprenotazione }}</span>
                </div>

                <div class="col-md-4 mb-3 mb-md-0 border-start border-end px-md-4">
                  <div class="mb-2">
                    <span class="d-block text-muted small fw-semibold text-uppercase">Arrivo</span>
                    <span class="fw-medium">{{ formatDate(booking.iniziososta) }}</span>
                  </div>
                  <div>
                    <span class="d-block text-muted small fw-semibold text-uppercase">Uscita</span>
                    <span class="fw-medium">{{ formatDate(booking.finesosta) }}</span>
                  </div>
                </div>

                <div class="col-md-3 mb-3 mb-md-0 ps-md-4">
                  <div class="mb-2">
                    <span class="d-block text-muted small fw-semibold text-uppercase">Posto Auto</span>
                    <span class="fw-bold text-dark fs-5">{{ booking.codiceposto }}</span>
                  </div>
                  <div>
                    <span class="d-block text-muted small fw-semibold text-uppercase">Targa</span>
                    <span class="fw-medium border rounded px-2 py-1 bg-light text-uppercase font-monospace">{{
                      booking.targa || 'N/D' }}</span>
                  </div>
                </div>

                <div class="col-md-2 text-md-end text-start mt-3 mt-md-0">
                  <span class="d-block text-muted small fw-semibold text-uppercase mb-1">Totale</span>
                  <span class="fw-bold fs-4 text-success">€ {{ Number(booking.prezzototale).toFixed(2) }}</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div class="col-12 mt-4" v-if="prenotazioniFiltrate.length > 0">
          <Pagination v-model:paginaCorrente="paginaCorrente" v-model:elementiPerPagina="elementiPerPagina"
            :totaleElementi="prenotazioniFiltrate.length" @cambio-pagina="scrollInAlto" />
        </div>

      </div>
    </main>

    <!-- Componente ChatBox montato come Popup fluttuante -->
    <div v-if="chatSelezionata" class="chat-popup-container">
      <ChatBox :idPrenotazione="chatSelezionata.idPrenotazione" :idDestinatario="chatSelezionata.idDestinatario"
        :nomeDestinatario="chatSelezionata.nomeDestinatario" ruoloDestinatario="Gestore" @chiudi="chiudiChat" />
    </div>

    <Footer />

    <Transition name="overlay-fade">
      <div v-if="showReviewModal" class="review-overlay" @click.self="chiudiModale">
        <Transition name="modal-slide" appear>
          <div class="review-modal">

            <div class="review-topbar">
              <div v-if="currentStep < 3" class="step-track">
                <span :class="['step-pip', currentStep >= 1 ? 'step-pip--on' : '']"></span>
                <span :class="['step-pip', currentStep >= 2 ? 'step-pip--on' : '']"></span>
              </div>
              <div v-else class="step-track"></div>
              <button v-if="currentStep < 3" class="close-btn" @click="chiudiModale" aria-label="Chiudi">
                <i class="bi bi-x"></i>
              </button>
            </div>

            <div v-if="reviewError" class="alert error mx-4 mt-3 mb-0 text-start">
              {{ reviewError }}
            </div>

            <div v-if="currentStep === 1" class="review-body">
              <span class="garage-chip">{{ selectedBookingForReview?.nomegarage }}</span>
              <h3 class="modal-title">{{ isEditing ? 'Modifica la tua recensione' : 'Com\'è andata la sosta?' }}</h3>
              <p class="modal-sub">Condividi la tua esperienza con la community Parkly</p>

              <div class="big-stars">
                <i v-for="star in 5" :key="star" class="bi big-star"
                  :class="star <= recensioneForm.votoGenerale ? 'bi-star-fill big-star--on' : 'bi-star'"
                  @click="recensioneForm.votoGenerale = star"></i>
              </div>

              <div class="field-wrap">
                <label class="field-label">
                  Raccontaci di più
                  <span class="optional-pill">opzionale</span>
                </label>
                <textarea v-model="recensioneForm.commento" class="review-textarea" rows="3"
                  placeholder="Com'era il parcheggio? Il personale è stato gentile?">
                </textarea>
              </div>

              <div class="d-flex gap-2">
                <button v-if="isEditing" class="cta-btn cta-btn--danger-ghost" @click="handleElimina"
                  title="Elimina recensione">
                  <i class="bi bi-trash"></i>
                </button>

                <button class="cta-btn" :disabled="recensioneForm.votoGenerale === 0" @click="currentStep = 2">
                  Continua
                  <i class="bi bi-arrow-right"></i>
                </button>
              </div>
            </div>

            <div v-if="currentStep === 2" class="review-body">
              <button class="back-btn" @click="currentStep = 1">
                <i class="bi bi-arrow-left"></i>
              </button>

              <h3 class="modal-title">Un ultimo dettaglio</h3>
              <p class="modal-sub">Come valuti questi aspetti specifici?</p>

              <div class="cat-list">
                <div v-for="cat in categories" :key="cat.id" class="cat-row">
                  <div class="cat-label">
                    <i :class="['cat-icon', cat.icon]"></i>
                    <span>{{ cat.label }}</span>
                  </div>
                  <div class="cat-stars">
                    <i v-for="star in 5" :key="star" class="bi cat-star"
                      :class="star <= recensioneForm[cat.id] ? 'bi-star-fill cat-star--on' : 'bi-star'"
                      @click="recensioneForm[cat.id] = star"></i>
                  </div>
                </div>
              </div>

              <button class="cta-btn cta-btn--green" :disabled="!isStep2Complete" @click="inviaRecensione">
                <i class="bi bi-send-fill"></i>
                Invia Recensione
              </button>
            </div>

            <div v-if="currentStep === 3" class="review-body review-body--success">
              <h3 class="modal-title">Grazie mille!</h3>
              <p class="modal-sub">La tua recensione è stata pubblicata e aiuterà gli altri utenti di Parkly a scegliere
                meglio.</p>
              <button class="cta-btn cta-btn--ghost" @click="chiudiEAggiorna">
                Torna alle prenotazioni
              </button>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
    <Transition name="overlay-fade">
      <div v-if="showCancelModal" class="review-overlay" @click.self="showCancelModal = false">
        <Transition name="modal-slide" appear>
          <div class="review-modal p-4 text-center">
            <h3 class="fw-bold mb-3" style="color: #00408A">ANNULLA PRENOTAZIONE</h3>
            <p class="text-muted">Stai per annullare la sosta per: <br />
              <strong>{{ bookingToCancel?.nomegarage }}</strong> ({{ bookingToCancel?.codiceprenotazione }})
            </p>

            <div class="my-4 p-3 rounded-3 bg-light border">
              <div :class="['fs-5 fw-bold', infoAnnullamento.classe]">
                {{ infoAnnullamento.messaggio }}: € {{ infoAnnullamento.rimborso.toFixed(2) }}
              </div>
              <p class="small text-dark mt-2 mb-0" style="line-height: 1.3;">
                {{ infoAnnullamento.motivazione }}
              </p>
            </div>

            <div class="d-flex gap-2">
              <button class="cta-btn cta-btn--ghost w-50" @click="showCancelModal = false">Indietro</button>
              <button class="cta-btn cta-btn--danger-ghost w-50" @click="handleConfirmCancel">Conferma</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.title-color {
  color: var(--primary-blue, #00408A);
  letter-spacing: -0.5px;
}

.booking-card {
  border-radius: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.booking-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08) !important;
}

.empty-state {
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
}

.btn-primary {
  background-color: var(--primary-blue, #00408A);
  border: none;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary:hover {
  background-color: #00336E;
}

/* Stile per replicare l'estetica delle targhe */
.font-monospace {
  letter-spacing: 2px;
  font-family: 'Courier New', Courier, monospace;
}

/* CSS per il popup della chat */
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

/* --- UNITÀ STILISTICA: BADGE E PULSANTI --- */
.action-group {
  flex-wrap: wrap;
  /* Evita che si schiaccino su schermi molto piccoli */
}

/* Base comune per altezza, font e bordi */
.custom-badge,
.custom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  height: 36px;
}

/* --- Badge di Stato --- */
.custom-badge {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  cursor: default;
  border-radius: 99px;
  /* Raggio diverso perchè lo stato NON è un bottone*/
}

.badge-attiva {
  background-color: #137333;
  color: #ffffff;
  border-color: #137333;
}

.badge-conclusa {
  background-color: #4a4d51;
  color: #ffffff;
  border-color: #4a4d51;
}

.badge-annullata {
  background-color: #c5221f;
  color: #ffffff;
  border-color: #c5221f;
}

.btn-chat {
  background-color: #e0f0ff;
  color: var(--primary-blue, #00408A);
  border-color: #b3d7ff;
  cursor: pointer;
  gap: 0.4rem;
  position: relative;
}

.btn-chat:hover {
  background-color: var(--primary-blue, #00408A);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 64, 138, 0.15);
}

.chat-notification-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  background-color: #ef4444;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  z-index: 2;
}

/* --- Pulsante Annulla --- */
.btn-cancel {
  background-color: white;
  color: #c5221f;
  border-color: #fad2cf;
  cursor: pointer;
  gap: 0.3rem;
}

.btn-cancel:hover {
  background-color: #c5221f;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(197, 34, 31, 0.15);
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

.trigger-stars i {
  cursor: pointer;
  transition: transform 0.2s;
}

.trigger-stars i:hover {
  transform: scale(1.2);
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
  width: 22px;
  background: var(--primary-blue, #00408A);
}


.review-body {
  padding: 1rem 1.75rem 1.5rem;
}

.review-body--success {
  padding-top: 1.5rem;
  text-align: center;
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


.big-stars {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 0.65rem;
}

.big-star {
  font-size: 2.4rem;
  cursor: pointer;
  color: #dde3ed;
  padding: 4px;
  margin: -4px;
  transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.18s ease, filter 0.18s ease;
}

.big-star--on {
  color: #f59e0b;
  filter: drop-shadow(0 3px 10px rgba(245, 158, 11, 0.45));
}

.big-star:hover {
  transform: scale(1.28) translateY(-4px);
}

.big-star:active {
  transform: scale(0.88);
}

.field-wrap {
  margin-bottom: 1.1rem;
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
  margin-bottom: 0.6rem;
}

.optional-pill {
  background: #f1f5f9;
  color: #94a3b8;
  font-size: 0.68rem;
  padding: 2px 9px;
  border-radius: 99px;
  text-transform: lowercase;
  letter-spacing: 0;
  font-weight: 600;
}

.cta-btn--green {
  background: #059669;
}

.cta-btn--green:hover:not(:disabled) {
  background: #047857;
  box-shadow: 0 8px 28px rgba(5, 150, 105, 0.3);
}

.back-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.6rem;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #0f172a;
}

.btn-edit-icon {
  background: transparent;
  color: var(--primary-blue, #00408A);
  border: 1.5px solid var(--primary-blue, #00408A);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.btn-edit-icon:hover {
  background: var(--primary-blue, #00408A);
  border-color: var(--primary-blue, #00408A);
  color: white;
  transform: translateY(-1px);
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 1.1rem;
}

.cat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 13px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1.5px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.cat-row:hover {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.cat-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  color: #334155;
}

.cat-icon {
  font-size: 1.1rem;
}

.cat-stars {
  display: flex;
  gap: 3px;
}

.cat-star {
  font-size: 1.3rem;
  cursor: pointer;
  color: #dde3ed;
  padding: 4px;
  margin: -4px;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.15s ease, filter 0.15s ease;
}

.cat-star--on {
  color: #f59e0b;
  filter: drop-shadow(0 2px 6px rgba(245, 158, 11, 0.4));
}

.cat-star:hover {
  transform: scale(1.3) translateY(-2px);
}

.cat-star:active {
  transform: scale(0.85);
}

.success-ring-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-halo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(rgba(0, 64, 138, 0.12),
      rgba(245, 158, 11, 0.18),
      rgba(0, 64, 138, 0.08),
      rgba(245, 158, 11, 0.14));
  animation: haloSpin 6s linear infinite, haloPulse 2.5s ease-in-out infinite;
}

.success-emoji {
  font-size: 3.2rem;
  position: relative;
  animation: popIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  filter: drop-shadow(0 4px 12px rgba(245, 158, 11, 0.5));
}

@keyframes haloSpin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes haloPulse {

  0%,
  100% {
    opacity: 0.6;
    transform: scale(1) rotate(0deg);
  }

  50% {
    opacity: 1;
    transform: scale(1.08) rotate(180deg);
  }
}

@keyframes popIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }

  60% {
    transform: scale(1.18);
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.garage-title-link {
  transition: color 0.2s ease;
}

.garage-title-link:hover {
  color: var(--primary-blue, #00408A) !important;
  text-decoration: underline;
}
</style>