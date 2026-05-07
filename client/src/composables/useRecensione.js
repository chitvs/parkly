import { ref, computed } from 'vue'
import { recensioniStore } from '../store/recensioni.js'

export function useRecensione() {
  // 1. Stato del modale
  const showReviewModal = ref(false)
  const currentStep = ref(1)
  const selectedBookingForReview = ref(null)
  const isEditing = ref(false) 

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
    isEditing.value = false
    
    recensioneForm.value = {
      votoGenerale: starValue,
      commento: '',
      posizione: 0, qualitaPrezzo: 0, pulizia: 0, spazio: 0, sicurezza: 0
    }
    
    currentStep.value = 1
    showReviewModal.value = true
  }

  // Apre la modale pre-compilando i dati
  const apriModifica = async (booking) => {
    selectedBookingForReview.value = booking
    isEditing.value = true
    currentStep.value = 1
    showReviewModal.value = true

    // Recuperiamo i dati preesistenti dal server
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
      alert("Impossibile caricare i dati della recensione.")
      chiudiModale()
    }
  }

  const chiudiModale = () => {
    showReviewModal.value = false
  }

  const inviaRecensione = async () => {
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

    // Scegliamo dinamicamente il metodo da chiamare
    const response = isEditing.value 
      ? await recensioniStore.updateReview(payload) 
      : await recensioniStore.postReview(payload)

    if (response.success) {
      currentStep.value = 3
    } else {
      alert(response.error || "Si è verificato un errore durante l'invio della recensione.")
    }
  }

  // Elimina la recensione corrente
  const eliminaRecensione = async () => {
    const conferma = confirm("Sei sicuro di voler eliminare definitivamente questa recensione?")
    if (!conferma) return false

    const { id_prenotazione, id_utente, id_garage } = selectedBookingForReview.value
    const response = await recensioniStore.deleteReview(id_prenotazione, id_utente, id_garage)

    if (response.success) {
      chiudiModale()
      return true
    } else {
      alert(response.error || "Errore durante l'eliminazione.")
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
    iniziaRecensione,
    apriModifica, 
    chiudiModale,
    inviaRecensione,
    eliminaRecensione
  }
}