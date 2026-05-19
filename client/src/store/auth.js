/**
 * --- AUTH STORE ---
 * Questo modulo gestisce lo stato globale dell'autenticazione per l'intera app.
 * Sfrutta la reattività di Vue per aggiornare istantaneamente la UI quando l'utente fa login, logout o modifica i propri dati.
 * * RESPONSABILITÀ PRINCIPALI:
 * - Single Source of Truth: È l'unico punto autorizzato a modificare i dati utente.
 * - Persistenza: Sincronizza i dati con il `localStorage` per mantenere l'accesso ai refresh della pagina.
 * - Sessioni Server: Comunica col backend tramite apiClient per la gestione sicura dei cookie di sessione Express.
 */

import { reactive } from 'vue'
import { apiFetch } from '../utils/apiClient'
import { disconnectSocket } from '@/composables/useChat'


export const authStore = reactive({

  // STATO GLOBALE
  utente: null,  // Se null l'utente non è loggato.
  isInitialized: false, // Flag utilizzata per controllare la validità della sesione

  // Funzione centralizzata per aggiornare l'utente e per mantenere l'accesso anche al refresh della pagina
  setUtente(dati) {
    this.utente = dati;
    if (dati)
      localStorage.setItem('utente', JSON.stringify(dati));
    else
      localStorage.removeItem('utente');
  },

  // Verifica se la sessione server sia ancora valida tramite i cookie di sessione
  async checkAuth() {
    try {
      const response = await apiFetch('/api/auth/me', {
      });

      // Se ok aggiorni i dati utente
      if (response.ok) {
        const data = await response.json();
        this.setUtente(data.utente);
        // Altrimenti la sessione è scaduta o non valida
      } else {
        this.setUtente(null);
      }
    } catch (err) {
      console.error("Errore verifica auth:", err);
      this.setUtente(null);
    } finally {
      this.isInitialized = true; // In ogni caso il controllo della sessione è avvenuto.
    }
  },

  // AUTENTICAZIONE (login/register/logout)

  async login(identificatore, password) {
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identificatore, password }) //identificatore può essere nome utente o email
      });

      // Se il controllo fallisce si invia errore 
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || "Credenziali errate" };
      }

      // Altrimenti si aggiornano i dati dell'utente
      const data = await response.json();
      if (data.success) {
        this.setUtente(data.utente);
      }
      return data;

    } catch (err) {
      console.error("Errore di rete durante il login:", err);
      return { success: false, error: "Errore di connessione" };
    }
  },

  async register(payload) {
    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      // Se la registrazione avviene con successo si viene automaticamente loggati
      if (data.success && data.utente) {
        this.setUtente(data.utente);
      }
      return data;
    } catch (err) {
      console.error("Errore durante la registrazione:", err);
      return { success: false, error: "Errore di connessione" };
    }
  },

  async logout() {
    try {
      // In questo caso si invalida la sessione distruggendo i cookie
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.error("Errore durante il logout lato server:", err);
    } finally {
      this.setUtente(null); //Anche se il server non risponde per sicurezza forziamo il logout in locale
      disconnectSocket(); //chiudo socket usata per inviare messaggi tra utenti
    }
  },


  // GESTIONE PROFILO UTENTE


  async changePassword(currentPassword, newPassword) {
    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      return await response.json();
    } catch (error) {
      console.error("Errore cambio password:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  },

  async getProfile() {
    try {
      // Utilizzata per visualizzare i dati dell'utente nel profilo
      const response = await apiFetch('/api/auth/profile', {
        method: 'GET',
      });

      return await response.json();
    } catch (error) {
      console.error("Errore fetch profilo:", error);
      return { success: false };
    }
  },


  async updateProfile(payload) {
    try {
      // Utilizzata per cambiare i dati dell'utente nel profilo
      const response = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      // In questo caso aggiorniamo anche i dati dell'utente in locale per avere modifiche live
      if (data.success && data.utente) {
        this.setUtente(data.utente);
      }

      return data;
    } catch (error) {
      console.error("Errore salvataggio profilo:", error);
      return { success: false, error: "Errore di connessione col server" };
    }
  },


  async uploadAvatar(formData) {
    // Utilizzata per caricare l'immagine del profilo
    try {
      const response = await apiFetch('/api/auth/upload-avatar', {
        // In questo caso il contenttype non è necessario perchè il browser lo gestisce in automatico con il formData
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      // In questo caso si aggiorna immediatamente anche la foto profilo
      if (result.success && this.utente) {
        this.utente.fotoProfilo_URL = result.url;
        this.setUtente(this.utente);
      }

      return result;
    } catch (error) {
      console.error("Errore upload avatar:", error);
      return { success: false, error: "Errore di connessione durante il caricamento." };
    }
  },


  async deleteAccount() {
    // Utilizzata per cancellare l'account
    try {
      const res = await apiFetch('/api/auth/delete-account', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        this.setUtente(null); // puliamo lo stato locale
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'account:", error);
      return { success: false, error: "Errore di connessione" };
    }
  },

  async upgradeToGestore() {
    // Utilizzata per cambiare ruolo da CLIENTE a GESTORE, avendo così accesso alla dashboard
    try {
      const response = await apiFetch('/api/auth/upgrade-role', {
        method: 'PUT',
      });

      const data = await response.json();

      if (data.success) {
        this.utente.ruolo = 'GESTORE'; // Aggiornamento locale per sbloccare immediatamento le funzionalità del gestore
        this.setUtente(this.utente);
        return { success: true };
      }

      return { success: false, error: data.error || "Errore durante l'aggiornamento del ruolo" };
    } catch (error) {
      return { success: false, error: "Errore di connessione al server" };
    }
  }
})