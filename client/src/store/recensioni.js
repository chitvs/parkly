import { reactive } from 'vue'

export const recensioniStore = reactive({
  
  // Invia una nuova recensione al server
  async postReview(reviewData) {
    try {
      const response = await fetch('/api/recensioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reviewData)
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore invio recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  // Aggiorna una recensione esistente
  async updateReview(reviewData) {
    try {
      const response = await fetch(`/api/recensioni/${reviewData.id_prenotazione}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reviewData)
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore modifica recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  // Elimina una recensione
  async deleteReview(id_prenotazione, id_utente, id_garage) {
    try {
      // Passiamo id_utente e id_garage come query parameters
      const response = await fetch(`/api/recensioni/${id_prenotazione}?id_utente=${id_utente}&id_garage=${id_garage}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore eliminazione recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  // Recupera i dati di una recensione specifica
  async getReview(id_prenotazione) {
    try {
      const response = await fetch(`/api/recensioni/${id_prenotazione}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore recupero recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  }

})