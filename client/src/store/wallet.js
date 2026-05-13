import { reactive } from 'vue'
import { authStore } from './auth'

export const walletStore = reactive({

  saldoSospeso: 0,
  
  async ricaricaSaldo(payload) {
    try {
      const response = await fetch('/api/wallet/ricarica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();

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

  async getTransazioni() {
    try {
      const response = await fetch('/api/wallet/transazioni', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore fetch transazioni:", error);
      return { success: false, data: [] };
    }
  },

  async contabilizzaRicavi() {
      try {
        const res = await fetch('/api/wallet/contabilizza-ricavi', { method: 'POST' });
        const json = await res.json();
        
        if (json.success && json.data.sbloccati > 0) {
          authStore.utente.saldo = json.data.nuovoSaldo;
          await this.caricaSaldoSospeso(); 
        }
      } catch (err) {
        console.error("Errore contabilizzazione:", err);
      }
  },

  async caricaSaldoSospeso() {
    try {
      const res = await fetch('/api/wallet/saldo-sospeso');
      const json = await res.json();
      if (json.success) {
        this.saldoSospeso = json.data.totale;
      }
    } catch (err) {
      console.error("Errore recupero saldo sospeso:", err);
      this.saldoSospeso = 0;
    }
  },

  async prelevaFondi(payload) {
    try {
      const res = await fetch('/api/wallet/preleva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        authStore.utente.saldo = data.nuovoSaldo;
        authStore.setUtente(authStore.utente);
      }
      return data;
    } catch (error) {
      return { success: false, error: 'Errore durante il prelievo' };
    }
  }
})