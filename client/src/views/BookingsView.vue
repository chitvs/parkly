<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { prenotazioniStore } from '../store/prenotazioni.js'
import { useRecensione } from '../composables/useRecensione.js'

import 'bootstrap-icons/font/bootstrap-icons.css'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'

const bookings = ref([])
const isLoading = ref(true)

// variabili per i filtri e l'ordinamento
const filtroStato = ref('') // '' = Tutte, 'ATTIVA', 'CONCLUSA', 'ANNULLATA'
const ordinamento = ref('creazione_desc') // default: data creazione più recente

// variabili per la paginazione
const paginaCorrente = ref(1)
const elementiPerPagina = 5

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
  eliminaRecensione
} = useRecensione()

onMounted(async () => {
  await caricaPrenotazioni()
})

const caricaPrenotazioni = async () => {
  isLoading.value = true
  const response = await prenotazioniStore.getBookings()
  if (response.success) {
    bookings.value = response.data
  } else {
    alert(response.error || "Impossibile caricare le prenotazioni")
  }
  isLoading.value = false
}

// applica i filtri e l'ordinamento scelti
const prenotazioniFiltrate = computed(() => {
  // filtriamo solo per stato
  let risultato = bookings.value.filter(b => {
    return filtroStato.value === '' || b.stato === filtroStato.value
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
const totalePagine = computed(() => Math.ceil(prenotazioniFiltrate.value.length / elementiPerPagina))

const prenotazioniPaginate = computed(() => {
  const inizio = (paginaCorrente.value - 1) * elementiPerPagina
  return prenotazioniFiltrate.value.slice(inizio, inizio + elementiPerPagina)
})

const cambiaPagina = (pag) => {
  if (pag >= 1 && pag <= totalePagine.value) {
    paginaCorrente.value = pag
  }
}

// resetta la pagina a 1 ogni volta che cambia il filtro o l'ordinamento
watch([filtroStato, ordinamento], () => {
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
    minute: '2-digit'
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

const handleCancelBooking = async (codice) => {
  const confermato = confirm("Sei sicuro di voler annullare questa prenotazione? L'operazione non può essere annullata.")
  if (!confermato) return
  const response = await prenotazioniStore.cancelBooking(codice)
  if (response.success) {
    const bookingToUpdate = bookings.value.find(b => b.codiceprenotazione === codice)
    if (bookingToUpdate) bookingToUpdate.stato = 'ANNULLATA'
    alert("Prenotazione annullata con successo.")
  } else {
    alert(response.error || "Impossibile annullare la prenotazione.")
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
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <main class="container py-5 flex-grow-1">
      <div class="row mb-4">
        <div class="col-12 text-center text-md-start">
          <h2 class="fw-bold title-color">Le Tue Prenotazioni</h2>
          <p class="text-muted">Storico dei tuoi parcheggi su Parkly</p>
        </div>
      </div>

      <div class="row mb-4 g-3 align-items-center bg-white p-3 rounded-3 shadow-sm border" v-if="bookings.length > 0">
        <!-- MODIFICATO: ora è col-md-6 invece di 4 -->
        <div class="col-12 col-md-6">
          <label class="form-label text-muted small fw-bold text-uppercase mb-1">Stato Prenotazione</label>
          <select class="form-select" v-model="filtroStato">
            <option value="">Tutte</option>
            <option value="ATTIVA">Attive</option>
            <option value="CONCLUSA">Concluse</option>
            <option value="ANNULLATA">Annullate</option>
          </select>
        </div>

        <!-- MODIFICATO: ora è col-md-6 invece di 4 -->
        <div class="col-12 col-md-6">
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
        <img src="../assets/broken_car.png" alt="Nessuna prenotazione" width="120" class="mb-3 opacity-50">
        <h4 class="fw-bold text-muted">Nessuna prenotazione trovata</h4>
        <p class="text-muted">Non hai ancora effettuato nessuna prenotazione con noi.</p>
        <router-link to="/ricerca" class="btn btn-primary mt-3 px-4 py-2">Trova Parcheggio</router-link>
      </div>

      <div v-else-if="prenotazioniFiltrate.length === 0" class="text-center py-5 empty-state">
        <h5 class="fw-bold text-muted">Nessun risultato</h5>
        <p class="text-muted">Nessuna prenotazione corrisponde ai filtri selezionati.</p>
        <button class="btn btn-outline-primary mt-2" @click="filtroStato=''; ordinamento='creazione_desc'">Resetta Filtri</button>
      </div>

      <div v-else class="row g-4">
        <div class="col-12" v-for="(booking, index) in prenotazioniPaginate" :key="index">
          <div class="card booking-card border-0 shadow-sm">
            <div class="card-body p-4">

              <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom booking-header-row">
                <div>
                  <router-link :to="`/garage/${booking.id_garage}`" class="text-decoration-none">
                    <h5 class="fw-bold mb-0 text-dark garage-title-link">{{ booking.nomegarage }}</h5>
                  </router-link>
                  <small class="text-muted"><i class="bi bi-geo-alt-fill me-1"></i>{{ booking.indirizzo }}</small>
                </div>
                <div class="d-flex align-items-center gap-2 booking-actions-row">
                  <span class="badge rounded-pill px-3 py-2 text-uppercase fw-semibold"
                    :class="getStatusBadgeClass(booking.stato)">
                    {{ booking.stato }}
                  </span>

                  <button v-if="booking.stato === 'ATTIVA'" @click="handleCancelBooking(booking.codiceprenotazione)"
                    class="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center fw-bold fs-5"
                    style="width: 32px; height: 32px; padding-bottom: 4px;" title="Annulla Prenotazione">
                    &times;
                  </button>

                  <div v-if="booking.stato === 'CONCLUSA' && !booking.ha_recensito"
                    class="d-flex align-items-center ms-3 border-start ps-3 review-box">
                    <span class="text-muted small fw-semibold me-2 d-none d-sm-inline">Com'è andata?</span>
                    <div class="d-flex gap-1 trigger-stars">
                      <i v-for="star in 5" :key="star" class="bi bi-star text-warning cursor-pointer fs-5"
                        @click="iniziaRecensione(booking, star)"></i>
                    </div>
                  </div>

                  <div v-else-if="booking.stato === 'CONCLUSA' && booking.ha_recensito"
                    class="d-flex align-items-center gap-2 ms-3 border-start ps-3 reviewed-box">
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

        <div class="col-12 mt-4" v-if="totalePagine > 1">
          <div class="pagination-horizontal">
            <button class="page-btn" :disabled="paginaCorrente === 1"
              @click="cambiaPagina(paginaCorrente - 1)">«</button>

            <div class="page-numbers">
              <span v-for="p in totalePagine" :key="p" class="page-dot"
                :class="{ active: paginaCorrente === p }" @click="cambiaPagina(p)">{{ p }}</span>
            </div>

            <button class="page-btn" :disabled="paginaCorrente === totalePagine"
              @click="cambiaPagina(paginaCorrente + 1)">»</button>
          </div>
        </div>

      </div>
    </main>

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

.font-monospace {
  letter-spacing: 2px;
  font-family: 'Courier New', Courier, monospace;
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

.review-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 23, 0.55);
  backdrop-filter: blur(5px) saturate(130%);
  -webkit-backdrop-filter: blur(5px) saturate(130%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 1.25rem;
}

.review-modal {
  background: #ffffff;
  width: 100%;
  max-width: 448px;
  border-radius: 28px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 32px 80px rgba(0, 0, 0, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.06);
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

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f1f5f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  font-size: 1.15rem;
  transition: background 0.2s, color 0.2s;
  line-height: 1;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
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

.modal-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.35rem;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.modal-sub {
  font-size: 0.88rem;
  color: #64748b;
  margin-bottom: 1.1rem;
  line-height: 1.55;
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
  transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
  font-family: inherit;
  line-height: 1.6;
}

.review-textarea::placeholder {
  color: #a8b4c4;
}

.review-textarea:focus {
  background: #ffffff;
  border-color: var(--primary-blue, #00408A);
  box-shadow: 0 0 0 4px rgba(0, 64, 138, 0.09);
}

.cta-btn {
  width: 100%;
  padding: 14px 24px;
  background: var(--primary-blue, #00408A);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  transition: background 0.22s ease, box-shadow 0.22s ease, transform 0.15s ease, opacity 0.2s;
  letter-spacing: 0.01em;
}

.cta-btn:hover:not(:disabled) {
  background: #003070;
  box-shadow: 0 8px 28px rgba(0, 64, 138, 0.28);
  transform: translateY(-1px);
}

.cta-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}

.cta-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.cta-btn--green {
  background: #059669;
}

.cta-btn--green:hover:not(:disabled) {
  background: #047857;
  box-shadow: 0 8px 28px rgba(5, 150, 105, 0.3);
}

.cta-btn--ghost {
  background: transparent;
  color: var(--primary-blue, #00408A);
  border: 1.5px solid rgba(0, 64, 138, 0.18);
}

.cta-btn--ghost:hover {
  background: rgba(0, 64, 138, 0.05);
  border-color: rgba(0, 64, 138, 0.35);
  color: white;
  box-shadow: none;
  transform: none;
}

.cta-btn--danger-ghost {
  background: transparent;
  color: #dc3545;
  border: 1.5px solid rgba(220, 53, 69, 0.2);
  width: auto;
  padding-left: 18px;
  padding-right: 18px;
  flex-shrink: 0;
}

.cta-btn.cta-btn--danger-ghost:hover:not(:disabled) {
  background: #dc3545;
  border-color: rgba(220, 53, 69, 0.5);
  color: #ffffff;
  box-shadow: none;
  transform: none;
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

.garage-title-link {
  transition: color 0.2s ease;
}

.garage-title-link:hover {
  color: var(--primary-blue, #00408A) !important;
  text-decoration: underline;
}

/* Stili Paginazione Orizzontale */
.pagination-horizontal {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.page-btn {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #64748b;
    font-weight: bold;
    transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
    background: #f8fafc;
    border-color: var(--primary-blue, #00408A);
    color: var(--primary-blue, #00408A);
}

.page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #f1f5f9;
}

.page-numbers {
    display: flex;
    gap: 6px;
}

.page-dot {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    background: white;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.page-dot:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.page-dot.active {
    background: var(--primary-blue, #00408A);
    color: white;
    border-color: var(--primary-blue, #00408A);
}

/* =========================================
   📱 SOLO PER TELEFONO (Ottimizzato)
========================================= */
@media (max-width: 768px) {
    /* Blocca lo scorrimento orizzontale generale (il "gioco" destra/sinistra) */
    .page-wrapper {
        max-width: 100vw;
        overflow-x: hidden;
    }

    /* Permette all'intestazione della card di andare a capo dolcemente se non c'è spazio */
    .booking-header-row {
        flex-wrap: wrap;
        gap: 10px;
    }

    /* Rimpicciolisce un pochino le stelline per farle entrare meglio nella riga */
    .trigger-stars i {
        font-size: 1.1rem !important; /* Questo riduce le stelle rispetto al fs-5 di Bootstrap */
    }

    /* Riduce i margini della zona recensione per recuperare millimetri preziosi */
    .review-box, .reviewed-box {
        margin-left: 0.5rem !important;
        padding-left: 0.5rem !important;
    }
}
</style>