<script setup>
import { ref, onMounted } from 'vue'
import { authStore } from '../store/auth.js'

import Header from '../components/Header.vue' 
import Footer from '../components/Footer.vue'
import ChatBox from '../components/ChatBox.vue' // Importo la ChatBox

const bookings = ref([])
const isLoading = ref(true)

// Stato per gestire la chat aperta
const chatSelezionata = ref(null)

onMounted(async () => {
  // getBookings deve restituire anche id_garage e id_gestore
  const response = await authStore.getBookings()
  
  if (response.success) {
    bookings.value = response.data
  } else {
    alert(response.error || "Impossibile caricare le prenotazioni")
  }
  
  isLoading.value = false
})

// Funzione helper per formattare la data in italiano
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


// funzione per cancellare le prenotazioni
const handleCancelBooking = async (codice) => {
  // Chiedo conferma all'utente
  const confermato = confirm("Sei sicuro di voler annullare questa prenotazione? L'operazione non può essere annullata.");
  if (!confermato) return; // Se clicca "Annulla" nel popup, fermiamo tutto

  // Chiamiamo lo store
  const response = await authStore.cancelBooking(codice);

  if (response.success) {
    // Aggiorniamo visivamente la lista senza dover ricaricare la pagina
    const bookingToUpdate = bookings.value.find(b => b.codiceprenotazione === codice);
    if (bookingToUpdate) {
      bookingToUpdate.stato = 'ANNULLATA';
    }
    alert("Prenotazione annullata con successo.");
  } else {
    alert(response.error || "Impossibile annullare la prenotazione.");
  }
}

// Funzioni per aprire e chiudere la chat
const apriChat = (booking) => {
  // id_garage e id_gestore devono arrivare dalla query API (vedi fix route)
  chatSelezionata.value = {
    idGarage: Number(booking.id_garage),
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
      <div class="row mb-4">
        <div class="col-12 text-center text-md-start">
          <h2 class="fw-bold title-color">Le Tue Prenotazioni</h2>
          <p class="text-muted">Storico dei tuoi parcheggi su Parkly</p>
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

      <div v-else class="row g-4">
        <div class="col-12" v-for="(booking, index) in bookings" :key="index">
          <div class="card booking-card border-0 shadow-sm">
            <div class="card-body p-4">
              
              <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                <div>
                  <h5 class="fw-bold mb-0 text-dark">{{ booking.nomegarage }}</h5>
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                  Annulla
                  </button>
                  <!-- Pulsante Chat -->
                  <button 
                    v-if="booking.stato === 'ATTIVA'" 
                    @click="apriChat(booking)" 
                    class="custom-btn btn-chat"
                    title="Contatta il gestore"
                  >
                    <!--pallino notifica-->
                    <span v-if="booking.nonLetti > 0" class="chat-notification-dot"></span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                        Contatta
                  </button>
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
                    <span class="fw-medium border rounded px-2 py-1 bg-light text-uppercase font-monospace">{{ booking.targa || 'N/D' }}</span>
                  </div>
                </div>

                <div class="col-md-2 text-md-end text-start mt-3 mt-md-0">
                  <span class="d-block text-muted small fw-semibold text-uppercase mb-1">Totale</span>
                  <span class="fw-bold fs-4 text-success mb-2 d-block">€ {{ Number(booking.prezzototale).toFixed(2) }}</span>

                </div>

              </div>

            </div>
          </div>
        </div>
      </div>

    </main>

    <!-- Componente ChatBox montato come Popup fluttuante -->
    <div v-if="chatSelezionata" class="chat-popup-container">
      <ChatBox 
        :idGarage="chatSelezionata.idGarage"
        :idDestinatario="chatSelezionata.idDestinatario"
        :nomeDestinatario="chatSelezionata.nomeDestinatario"
        ruoloDestinatario="Gestore"
        @chiudi="chiudiChat"
      />
    </div>

    <Footer />
  </div>
</template>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f8f9fa; /* Sfondo leggermente grigio per far risaltare le card bianche */
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
  box-shadow: 0 10px 25px rgba(0,0,0,0.08) !important;
}

.empty-state {
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
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

/*  CSS PER IL POPUP DELLA CHAT */
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
  flex-wrap: wrap; /* Evita che si schiaccino su schermi molto piccoli */
}

/* Base comune per altezza, font e bordi */
.custom-badge, .custom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  border-radius: 8px; 
  border: 1px solid transparent;
  transition: all 0.2s ease;
  height: 36px; /* Forza la stessa altezza per tutti gli elementi */
}

/* --- 1. Badge di Stato --- */
.custom-badge {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  cursor: default;
  border-radius: 99px; /* Raggio leggermente diverso perchè lo stato non è un bottone*/

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

/* --- 2. Pulsante Chat --- */
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
  background-color: #ef4444; /* Rosso vibrante */
  border: 2px solid #ffffff; /* Bordo bianco per staccarlo dallo sfondo */
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  z-index: 2;
}

/* --- 3. Pulsante Annulla --- */
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
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>