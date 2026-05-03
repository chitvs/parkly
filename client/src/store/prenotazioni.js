import { reactive } from 'vue'

export const prenotazioniStore = reactive({
  
  // funzione per recuperare le prenotazioni dell'utente loggato
  async getBookings() {
    try {
      const response = await fetch('/api/prenotazioni', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore fetch prenotazioni:", error);
      return { success: false, error: "Errore di connessione" };
    }
  },

  // funzione per annullare una prenotazione specifica tramite codice
  async cancelBooking(codicePrenotazione) {
    try {
      const response = await fetch(`/api/prenotazioni/${codicePrenotazione}/annulla`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore durante l'annullamento:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  }
})