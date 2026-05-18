/**
 * --- WALLET STORE ---
 * 
 * Gestisce le operazioni finanziarie degli utenti: ricariche per i clienti
 * e gestione dei ricavi (contabilizzazione, prelievi) per i gestori.
 * * NOTE ARCHITETTONICHE:
 * - Questo store comunica direttamente con `authStore`
 * per mantenere il saldo globale sincronizzato in tempo reale sulla UI.
 */

import { reactive } from 'vue'
import { authStore } from './auth'
import { apiFetch } from '../utils/apiClient'

export const walletStore = reactive({

  saldoSospeso: 0,

  // AZIONI CLIENTE E GESTORE
  
  // Permette al cliente di ricaricare il proprio saldo
  async ricaricaSaldo(payload) {
    try {
      const response = await apiFetch('/api/wallet/ricarica', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      // Comunica direttamente con authStore per aggiornamento live della UI
      if (data.success && authStore.utente) {
        authStore.utente.saldo = data.nuovoSaldo;
        authStore.setUtente(authStore.utente);
      }
      
      return data;
    } catch (error) {
      console.error("Errore ricarica saldo:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  // Permette all'utente di trasferire il saldo locale su un saldo esterno.
  async prelevaFondi(payload) {
    try {
      const res = await apiFetch('/api/wallet/preleva', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      // Comunica direttamente con authStore per aggiornamento live della UI
      if (data.success) {
        authStore.utente.saldo = data.nuovoSaldo;
        authStore.setUtente(authStore.utente);
      }
      return data;
    } catch (error) {
      return { success: false, error: 'Errore durante il prelievo' };
    }
  },

  // Recupera lo storico dei movimenti quali ricariche, pagamenti, prelievi, rimporsi...
  async getTransazioni() {
    try {
      const response = await apiFetch('/api/wallet/transazioni', {
        method: 'GET',
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore fetch transazioni:", error);
      return { success: false, data: [] };
    }
  },

  // AZIONI GESTORE

  // Sposta i fondi delle prenotazioni concluse da incasso-sospeso a incasso-completato, quindi prelevabili.
  async contabilizzaRicavi() {
      try {
        const res = await apiFetch('/api/wallet/contabilizza-ricavi', { 
          method: 'POST',
        });
        const json = await res.json();
        
        // Comunica direttamente con lo store per aggiornamento live della UI
        if (json.success && json.data.sbloccati > 0) {
          authStore.utente.saldo = json.data.nuovoSaldo;
          authStore.setUtente(authStore.utente);
          await this.caricaSaldoSospeso(); 
        }
      } catch (err) {
        console.error("Errore contabilizzazione:", err);
      }
  },

  // Interroga il server per sapere la quantità dei fondi in sospeso
  async caricaSaldoSospeso() {
    try {
      const res = await apiFetch('/api/wallet/saldo-sospeso', {
        method: 'GET',
      });
      const json = await res.json();
      if (json.success) {
        this.saldoSospeso = json.data.totale;
      }
    } catch (err) {
      console.error("Errore recupero saldo sospeso:", err);
      this.saldoSospeso = 0;
    }
  },

})