<script setup>
import { ref, onMounted } from 'vue'
import { authStore } from '../store/auth.js'

import Header from '../components/Header.vue' 
import Footer from '../components/Footer.vue'

const bookings = ref([])
const isLoading = ref(true)

onMounted(async () => {
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

// Funzione helper per assegnare il colore al badge in base allo stato
const getStatusBadgeClass = (stato) => {
  switch(stato) {
    case 'ATTIVA': return 'bg-success' // Verde
    case 'CONCLUSA': return 'bg-secondary' // Grigio
    case 'ANNULLATA': return 'bg-danger' // Rosso
    default: return 'bg-primary'
  }
}

// funzione per cancellazione prenotazioni
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
                <div class="d-flex align-items-center gap-2">
  
                  <span class="badge rounded-pill px-3 py-2 text-uppercase fw-semibold" :class="getStatusBadgeClass(booking.stato)">
                    {{ booking.stato }}
                  </span>
                  
                  <button 
                      v-if="booking.stato === 'ATTIVA'" 
                      @click="handleCancelBooking(booking.codiceprenotazione)" 
                      class="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center fw-bold fs-5"
                      style="width: 32px; height: 32px; padding-bottom: 4px;"
                      title="Annulla Prenotazione"
                  >
                  &times; </button>
  
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
                  <span class="fw-bold fs-4 text-success">€ {{ Number(booking.prezzototale).toFixed(2) }}</span>
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>

    </main>

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

/* Stile per replicare un po' l'estetica delle targhe */
.font-monospace {
  letter-spacing: 2px;
  font-family: 'Courier New', Courier, monospace;
}
</style>