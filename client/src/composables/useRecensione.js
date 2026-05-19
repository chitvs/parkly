/**
* Gestisce lo stato e la logica per le recensioni 
* (creazione, modifica ed eliminazione), intefacciandosi direttamente
* con recensioniStore. 
*/

import { ref, computed } from 'vue'
import { recensioniStore } from '../store/recensioni.js'

export function useRecensione() {

  // STATI
  const showReviewModal = ref(false)
  const currentStep = ref(1) // Gestisce i passaggi del form 
  const selectedBookingForReview = ref(null)
  const isEditing = ref(false) // Flag per distinguere tra nuova recensione (POST) e modifica (PUT)
  const reviewError = ref('')

  const recensioneForm = ref({
    votoGenerale: 0,
    commento: '',
    posizione: 0,
    qualitaPrezzo: 0,
    pulizia: 0,
    spazio: 0,
    sicurezza: 0
  })

  // Controlli di validazione

  // Verifica che l'utente abbia assegnato almeno una stella a tutti i parametri di dettaglio prima di permettere l'invio del form.
  const isStep2Complete = computed(() => {
    return recensioneForm.value.posizione > 0 &&
      recensioneForm.value.qualitaPrezzo > 0 &&
      recensioneForm.value.pulizia > 0 &&
      recensioneForm.value.spazio > 0 &&
      recensioneForm.value.sicurezza > 0
  })



  // Avvia il flusso per iniziare a scrivere una recensione.
  const iniziaRecensione = (booking, starValue) => {
    reviewError.value = ''
    selectedBookingForReview.value = booking
    isEditing.value = false

    // Reset del form
    recensioneForm.value = {
      votoGenerale: starValue,
      commento: '',
      posizione: 0, qualitaPrezzo: 0, pulizia: 0, spazio: 0, sicurezza: 0
    }

    currentStep.value = 1
    showReviewModal.value = true
  }

  // In caso di modifica invece avvia il flusso e recupera i valori già esistenti
  const apriModifica = async (booking) => {
    reviewError.value = ''
    selectedBookingForReview.value = booking
    isEditing.value = true
    currentStep.value = 1
    showReviewModal.value = true

    const response = await recensioniStore.getReview(booking.id_prenotazione)

    if (response.success && response.data) {
      const rec = response.data
      recensioneForm.value = {
        votoGenerale: rec.votogenerale,
        commento: rec.commento || '',
        posizione: rec.votoposizione,
        qualitaPrezzo: rec.votoprezzo,
        pulizia: rec.votopulizia,
        spazio: rec.votospazio,
        sicurezza: rec.votosicurezza
      }
    } else {
      reviewError.value = "Impossibile caricare i dati della recensione."
    }
  }

  const chiudiModale = () => {
    showReviewModal.value = false
  }

  // In base alla flag isEditing gestisce quale chiamata tra POST e PUT utilizzare
  const inviaRecensione = async () => {
    reviewError.value = ''
    const payload = {
      id_prenotazione: selectedBookingForReview.value.id_prenotazione,
      id_garage: selectedBookingForReview.value.id_garage,
      voto_generale: recensioneForm.value.votoGenerale,
      voto_posizione: recensioneForm.value.posizione,
      voto_prezzo: recensioneForm.value.qualitaPrezzo,
      voto_pulizia: recensioneForm.value.pulizia,
      voto_spazio: recensioneForm.value.spazio,
      voto_sicurezza: recensioneForm.value.sicurezza,
      commento: recensioneForm.value.commento
    }

    const response = isEditing.value
      ? await recensioniStore.updateReview(payload)
      : await recensioniStore.postReview(payload)

    if (response.success) {
      currentStep.value = 3
    } else {
      reviewError.value = response.error || "Si è verificato un errore durante l'invio della recensione."
    }
  }

  // Chiede conferma all'utente e procede all'eliminazione della recensione.
  const eliminaRecensione = async () => {
    const conferma = window.confirm("Sei sicuro di voler eliminare definitivamente questa recensione?")
    if (!conferma) return false

    reviewError.value = ''

    const { id_prenotazione, id_garage } = selectedBookingForReview.value

    const response = await recensioniStore.deleteReview(id_prenotazione, id_garage)

    if (response.success) {
      chiudiModale()
      return true
    } else {
      reviewError.value = response.error || "Errore durante l'eliminazione."
      return false
    }
  }

  return {
    showReviewModal,
    currentStep,
    selectedBookingForReview,
    recensioneForm,
    isStep2Complete,
    isEditing,
    reviewError,

    iniziaRecensione,
    apriModifica,
    chiudiModale,
    inviaRecensione,
    eliminaRecensione
  }
}