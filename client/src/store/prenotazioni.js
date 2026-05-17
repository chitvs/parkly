import { reactive } from 'vue'
import { authStore } from './auth'

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

  // funzione per annullare una prenotazione specifica tramite codice e rimborsare il saldo
  async cancelBooking(codicePrenotazione) {
    try {
      const response = await fetch(`/api/prenotazioni/${codicePrenotazione}/annulla`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      const data = await response.json();

      // se l'annullamento ha successo, aggiorniamo il saldo
      if (data.success && data.nuovoSaldo !== undefined) {
        if (authStore.utente) {
          authStore.utente.saldo = data.nuovoSaldo;
          authStore.setUtente(authStore.utente);
        }
      }

      return data;
    } catch (error) {
      console.error("Errore durante l'annullamento:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  async getAnteprimaAnnullamento(codice) {
      try {
          const response = await fetch(`/api/prenotazioni/${codice}/anteprima-annullamento`);
          return await response.json();
      } catch (error) {
          console.error("Errore:", error);
          return { success: false, error: "Errore di connessione" };
      }
  }, 

  // Recupera lo storico di tutte le prenotazioni relative ai garage del gestore
  async getPrenotazioniGestore() {
    try {
      const response = await fetch('/api/prenotazioni/prenotazioni-gestore', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      console.error("Errore fetch prenotazioni gestore:", error);
      return { success: false, error: "Errore di connessione" };
    }
  },
  
})