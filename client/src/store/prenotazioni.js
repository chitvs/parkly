/**
 * --- PRENOTAZIONI STORE --- 
 * 
 * Gestisce il ciclo di vita delle prenotazioni, sia per il normale Cliente 
 * (consultazione, annullamento, calcolo rimborsi) sia per il Gestore (storico).
 * - Questo store è accoppiato con `authStore` per necessità di business: 
 * quando una prenotazione viene annullata, il saldo dell'utente deve 
 * aggiornarsi in tempo reale su tutta la UI senza ricaricare la pagina.
 */

import { reactive } from 'vue'
import { authStore } from './auth'
import { apiFetch } from '../utils/apiClient'

export const prenotazioniStore = reactive({

  // AZIONI LATO CLIENTE

  // Recupera la lista completa delle prenotazioni dell'utente
  async getBookings() {
    try {
      const response = await apiFetch('/api/prenotazioni', {
        method: 'GET',
      });

      return await response.json();
    } catch (error) {
      console.error("Errore fetch prenotazioni:", error);
      return { success: false, error: "Errore di connessione" };
    }
  },

  // Simula un annullamento per calcolare il rimborso previsto. 
  // Viene quindi utilizzata prima di confermare l'annullamento.
  async getAnteprimaAnnullamento(codice) {
    try {
      const response = await apiFetch(`/api/prenotazioni/${codice}/anteprima-annullamento`, {
        method: 'GET',
      });
      return await response.json();
    } catch (error) {
      console.error("Errore:", error);
      return { success: false, error: "Errore di connessione" };
    }
  },

  // Processa l'annullamento effettivo
  async cancelBooking(codicePrenotazione) {
    try {
      const response = await apiFetch(`/api/prenotazioni/${codicePrenotazione}/annulla`, {
        method: 'PUT',
      });

      const data = await response.json();

      // Se l'annullamento avviene con successo si aggiorna il saldo comunicando con authStore
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


  // AZIONI LATO GESTORE

  // Recupera lo storico di tutte le prenotazioni relative ai garage di proprietà del gestore 
  async getPrenotazioniGestore() {
    try {
      const response = await apiFetch('/api/prenotazioni/prenotazioni-gestore', {
        method: 'GET',
      });
      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      console.error("Errore fetch prenotazioni gestore:", error);
      return { success: false, error: "Errore di connessione" };
    }
  },

})