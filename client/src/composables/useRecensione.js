import { ref, computed } from 'vue'
import { recensioniStore } from '../store/recensioni.js'

export function useRecensione() {
  // 1. Stato del modale
  const showReviewModal = ref(false)
  const currentStep = ref(1)
  const selectedBookingForReview = ref(null)

  // 2. Dati del form
  const recensioneForm = ref({
    votoGenerale: 0,
    commento: '',
    posizione: 0,
    qualitaPrezzo: 0,
    pulizia: 0,
    spazio: 0,
    sicurezza: 0
  })

  // 3. Controlli
  const isStep2Complete = computed(() => {
    return recensioneForm.value.posizione > 0 &&
           recensioneForm.value.qualitaPrezzo > 0 &&
           recensioneForm.value.pulizia > 0 &&
           recensioneForm.value.spazio > 0 &&
           recensioneForm.value.sicurezza > 0
  })

  // 4. Azioni
  const iniziaRecensione = (booking, starValue) => {
    selectedBookingForReview.value = booking
    
    // Reset del form in caso fosse stato chiuso a metà
    recensioneForm.value = {
      votoGenerale: starValue,
      commento: '',
      posizione: 0, qualitaPrezzo: 0, pulizia: 0, spazio: 0, sicurezza: 0
    }
    
    currentStep.value = 1
    showReviewModal.value = true
  }

  const chiudiModale = () => {
    showReviewModal.value = false
  }

const inviaRecensione = async () => {
    // Mappatura dei dati per il backend
    const payload = {
      id_prenotazione: selectedBookingForReview.value.id_prenotazione,
      id_utente: selectedBookingForReview.value.id_utente,
      id_garage: selectedBookingForReview.value.id_garage,
      voto_generale: recensioneForm.value.votoGenerale,
      voto_posizione: recensioneForm.value.posizione,
      voto_prezzo: recensioneForm.value.qualitaPrezzo,
      voto_pulizia: recensioneForm.value.pulizia,
      voto_spazio: recensioneForm.value.spazio,
      voto_sicurezza: recensioneForm.value.sicurezza,
      commento: recensioneForm.value.commento
    }

    // Chiamiamo il nuovo store
    const response = await recensioniStore.postReview(payload)

    if (response.success) {
      currentStep.value = 3
    } else {
      alert(response.error || "Si è verificato un errore durante l'invio della recensione.")
    }
  }

  // Esponiamo le cose che serviranno alla View
  return {
    showReviewModal,
    currentStep,
    selectedBookingForReview,
    recensioneForm,
    isStep2Complete,
    iniziaRecensione,
    chiudiModale,
    inviaRecensione
  }
}