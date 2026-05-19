/**
 * --- RECENSIONI STORE ---
 * 
 * * Gestisce le operazioni leagte alle recensioni.
 * * NOTE ARCHITETTONICHE:
 * - A differenza degli altri store lascia ai singoli componenti Vue 
 * il compito di salvare e mostrare i dati restituiti.
 */

import { reactive } from 'vue'
import { apiFetch } from '../utils/apiClient'

export const recensioniStore = reactive({

  // Invia una nuova recensione al server
  async postReview(reviewData) {
    try {
      const response = await apiFetch('/api/recensioni', {
        method: 'POST',
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
      const response = await apiFetch(`/api/recensioni/${reviewData.id_prenotazione}`, {
        method: 'PUT',
        body: JSON.stringify(reviewData)
      });

      return await response.json();
    } catch (error) {
      console.error("Errore modifica recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  // Elimina una recensione
  async deleteReview(id_prenotazione, id_garage) {
    try {
      // Passiamo id_utente e id_garage come query parameters
      const response = await apiFetch(`/api/recensioni/${id_prenotazione}?id_garage=${id_garage}`, {
        method: 'DELETE',
      });

      return await response.json();
    } catch (error) {
      console.error("Errore eliminazione recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  // Recupera i dati di una recensione specifica modo tale da pre-comipilare il form in fase di modifica
  async getReview(id_prenotazione) {
    try {
      const response = await apiFetch(`/api/recensioni/${id_prenotazione}`, {
        method: 'GET',
      });

      return await response.json();
    } catch (error) {
      console.error("Errore recupero recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  }

})