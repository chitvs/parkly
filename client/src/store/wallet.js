import { reactive } from 'vue'
import { authStore } from './auth'

export const walletStore = reactive({
  
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
  }
})